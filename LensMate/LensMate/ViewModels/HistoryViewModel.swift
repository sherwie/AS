import Foundation
import SwiftData
import Combine

/// Groups sessions by date for display
struct DailySessionGroup: Identifiable {
    let id: Date
    let date: Date
    let sessions: [WearSession]

    var totalSeconds: Int {
        sessions.reduce(0) { $0 + $1.totalDurationSeconds }
    }

    var formattedTotal: String {
        Formatters.formatDuration(seconds: totalSeconds)
    }

    var formattedDate: String {
        Formatters.relativeDate(date)
    }
}

/// Time range filter options
enum HistoryFilter: String, CaseIterable {
    case week = "Week"
    case month = "Month"
    case threeMonths = "3 Months"
    case year = "Year"
    case all = "All"

    var startDate: Date {
        let calendar = Calendar.current
        switch self {
        case .week:
            return calendar.date(byAdding: .day, value: -7, to: Date()) ?? Date()
        case .month:
            return calendar.date(byAdding: .month, value: -1, to: Date()) ?? Date()
        case .threeMonths:
            return calendar.date(byAdding: .month, value: -3, to: Date()) ?? Date()
        case .year:
            return calendar.date(byAdding: .year, value: -1, to: Date()) ?? Date()
        case .all:
            return Date.distantPast
        }
    }
}

/// Manages history view state and data
@MainActor
final class HistoryViewModel: ObservableObject {
    @Published var selectedFilter: HistoryFilter = .month {
        didSet {
            fetchSessions()
        }
    }
    @Published private(set) var dailyGroups: [DailySessionGroup] = []
    @Published private(set) var healthEntries: [HealthEntry] = []
    @Published private(set) var statistics: HistoryStatistics?
    @Published var selectedDate: Date?
    @Published var errorMessage: String?

    private let modelContext: ModelContext

    init(modelContext: ModelContext) {
        self.modelContext = modelContext
    }

    /// Load history data
    func loadData() {
        fetchSessions()
        fetchHealthEntries()
        calculateStatistics()
    }

    /// Get sessions for a specific date
    func sessions(for date: Date) -> [WearSession] {
        let startOfDay = date.startOfDay
        let endOfDay = date.endOfDay

        return dailyGroups
            .first { Calendar.current.isDate($0.date, inSameDayAs: date) }?
            .sessions ?? []
    }

    /// Get health entries for a specific date
    func healthEntries(for date: Date) -> [HealthEntry] {
        healthEntries.filter { Calendar.current.isDate($0.date, inSameDayAs: date) }
    }

    /// Delete a session
    func deleteSession(_ session: WearSession) {
        modelContext.delete(session)
        saveContext()
        fetchSessions()
        calculateStatistics()
    }

    /// Dates with wear sessions for calendar highlighting
    var datesWithSessions: Set<Date> {
        Set(dailyGroups.map { Calendar.current.startOfDay(for: $0.date) })
    }

    // MARK: - Private Methods

    private func fetchSessions() {
        let startDate = selectedFilter.startDate

        let descriptor = FetchDescriptor<WearSession>(
            predicate: #Predicate { session in
                session.date >= startDate && !session.isActive
            },
            sortBy: [SortDescriptor(\.date, order: .reverse)]
        )

        do {
            let sessions = try modelContext.fetch(descriptor)
            groupSessionsByDate(sessions)
        } catch {
            errorMessage = "Failed to load history"
        }
    }

    private func groupSessionsByDate(_ sessions: [WearSession]) {
        let grouped = Dictionary(grouping: sessions) { session in
            Calendar.current.startOfDay(for: session.date)
        }

        dailyGroups = grouped
            .map { DailySessionGroup(id: $0.key, date: $0.key, sessions: $0.value) }
            .sorted { $0.date > $1.date }
    }

    private func fetchHealthEntries() {
        let startDate = selectedFilter.startDate

        let descriptor = FetchDescriptor<HealthEntry>(
            predicate: #Predicate { $0.date >= startDate },
            sortBy: [SortDescriptor(\.date, order: .reverse)]
        )

        do {
            healthEntries = try modelContext.fetch(descriptor)
        } catch {
            errorMessage = "Failed to load health entries"
        }
    }

    private func calculateStatistics() {
        let sessions = dailyGroups.flatMap { $0.sessions }

        guard !sessions.isEmpty else {
            statistics = nil
            return
        }

        let totalSeconds = sessions.reduce(0) { $0 + $1.totalDurationSeconds }
        let wearDays = dailyGroups.count

        let dailyTotals = dailyGroups.map { $0.totalSeconds }
        let maxDailySeconds = dailyTotals.max() ?? 0
        let averageDailySeconds = wearDays > 0 ? totalSeconds / wearDays : 0

        let comfortScores = sessions.compactMap { $0.comfortScore }
        let averageComfort = comfortScores.isEmpty ? nil :
            Double(comfortScores.reduce(0, +)) / Double(comfortScores.count)

        statistics = HistoryStatistics(
            totalSessions: sessions.count,
            totalWearDays: wearDays,
            totalWearSeconds: totalSeconds,
            averageDailySeconds: averageDailySeconds,
            maxDailySeconds: maxDailySeconds,
            averageComfortScore: averageComfort
        )
    }

    private func saveContext() {
        do {
            try modelContext.save()
        } catch {
            errorMessage = "Failed to save changes"
        }
    }
}

/// Statistics for the selected time period
struct HistoryStatistics {
    let totalSessions: Int
    let totalWearDays: Int
    let totalWearSeconds: Int
    let averageDailySeconds: Int
    let maxDailySeconds: Int
    let averageComfortScore: Double?

    var formattedTotalWear: String {
        Formatters.formatDuration(seconds: totalWearSeconds)
    }

    var formattedAverageDaily: String {
        Formatters.formatDuration(seconds: averageDailySeconds)
    }

    var formattedMaxDaily: String {
        Formatters.formatDuration(seconds: maxDailySeconds)
    }

    var formattedAverageComfort: String? {
        guard let score = averageComfortScore else { return nil }
        return String(format: "%.1f/10", score)
    }
}
