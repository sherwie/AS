import Foundation
import SwiftData
import Combine

/// Insight types prioritized by importance
enum InsightType: Int, Comparable {
    case replaceNow = 1
    case highWearWarning = 2
    case comfortTrend = 3
    case lowInventory = 4
    case checkupReminder = 5

    static func < (lhs: InsightType, rhs: InsightType) -> Bool {
        lhs.rawValue < rhs.rawValue
    }
}

/// Represents a single insight to display to the user
struct Insight: Identifiable {
    let id = UUID()
    let type: InsightType
    let title: String
    let message: String
    let iconName: String
    let actionLabel: String?
    let action: (() -> Void)?

    var priority: Int {
        type.rawValue
    }
}

/// Manages home screen state and insights
@MainActor
final class HomeViewModel: ObservableObject {
    @Published private(set) var currentInsight: Insight?
    @Published private(set) var weeklyTotalSeconds: Int = 0
    @Published private(set) var lensProfile: LensProfile?
    @Published private(set) var inventory: Inventory?
    @Published var errorMessage: String?

    private let modelContext: ModelContext

    init(modelContext: ModelContext) {
        self.modelContext = modelContext
    }

    /// Load home screen data
    func loadData() {
        fetchLensProfile()
        fetchInventory()
        calculateWeeklyTotal()
        generateInsight()
    }

    /// Formatted weekly total
    var formattedWeeklyTotal: String {
        Formatters.formatDuration(seconds: weeklyTotalSeconds)
    }

    /// Days until lens replacement
    var daysUntilReplacement: Int? {
        lensProfile?.daysUntilReplacement
    }

    /// Whether lenses are overdue
    var isOverdue: Bool {
        lensProfile?.isOverdue ?? false
    }

    /// Mark current lenses as replaced
    func replaceLenses() {
        lensProfile?.replaceLenses()
        inventory?.usePair()
        saveContext()
        generateInsight()
    }

    // MARK: - Private Methods

    private func fetchLensProfile() {
        let descriptor = FetchDescriptor<LensProfile>(
            predicate: #Predicate { $0.isActive }
        )

        do {
            let profiles = try modelContext.fetch(descriptor)
            lensProfile = profiles.first
        } catch {
            errorMessage = "Failed to load lens profile"
        }
    }

    private func fetchInventory() {
        let descriptor = FetchDescriptor<Inventory>()

        do {
            let inventories = try modelContext.fetch(descriptor)
            inventory = inventories.first
        } catch {
            errorMessage = "Failed to load inventory"
        }
    }

    private func calculateWeeklyTotal() {
        let startOfWeek = Date().startOfWeek
        let now = Date()

        let descriptor = FetchDescriptor<WearSession>(
            predicate: #Predicate { session in
                session.date >= startOfWeek && session.date <= now && !session.isActive
            }
        )

        do {
            let sessions = try modelContext.fetch(descriptor)
            weeklyTotalSeconds = sessions.reduce(0) { $0 + $1.totalDurationSeconds }
        } catch {
            errorMessage = "Failed to calculate weekly total"
        }
    }

    private func generateInsight() {
        var insights: [Insight] = []

        if let lens = lensProfile, let days = lens.daysUntilReplacement {
            if days <= 0 {
                insights.append(Insight(
                    type: .replaceNow,
                    title: "Time to Replace",
                    message: "Your \(lens.lensType.displayName) lenses should be replaced now.",
                    iconName: "exclamationmark.triangle.fill",
                    actionLabel: "Mark Replaced",
                    action: { [weak self] in self?.replaceLenses() }
                ))
            } else if days <= 2 {
                insights.append(Insight(
                    type: .replaceNow,
                    title: "Replace Soon",
                    message: "Replace your lenses \(Formatters.formatDaysRemaining(days)).",
                    iconName: "clock.fill",
                    actionLabel: nil,
                    action: nil
                ))
            }
        }

        if let inv = inventory, inv.isLowStock {
            insights.append(Insight(
                type: .lowInventory,
                title: "Low Stock",
                message: "Only \(inv.unitsRemaining) pair\(inv.unitsRemaining == 1 ? "" : "s") remaining.",
                iconName: "shippingbox.fill",
                actionLabel: nil,
                action: nil
            ))
        }

        insights.append(contentsOf: checkWearPatterns())
        insights.append(contentsOf: checkComfortTrends())
        insights.append(contentsOf: checkCheckupReminder())

        currentInsight = insights.sorted { $0.priority < $1.priority }.first
    }

    private func checkWearPatterns() -> [Insight] {
        var insights: [Insight] = []

        let startOfWeek = Date().startOfWeek
        let now = Date()

        let descriptor = FetchDescriptor<WearSession>(
            predicate: #Predicate { session in
                session.date >= startOfWeek && session.date <= now && !session.isActive
            }
        )

        guard let sessions = try? modelContext.fetch(descriptor) else { return insights }

        let longSessions = sessions.filter { $0.totalDurationSeconds > 10 * 3600 }
        if longSessions.count >= 3 {
            insights.append(Insight(
                type: .highWearWarning,
                title: "Extended Wear",
                message: "\(longSessions.count) days this week exceeded 10 hours.",
                iconName: "exclamationmark.circle.fill",
                actionLabel: nil,
                action: nil
            ))
        }

        return insights
    }

    private func checkComfortTrends() -> [Insight] {
        var insights: [Insight] = []

        let lastWeek = Calendar.current.date(byAdding: .day, value: -7, to: Date()) ?? Date()

        let descriptor = FetchDescriptor<HealthEntry>(
            predicate: #Predicate { $0.date >= lastWeek },
            sortBy: [SortDescriptor(\.date, order: .descending)]
        )

        guard let entries = try? modelContext.fetch(descriptor), entries.count >= 3 else {
            return insights
        }

        let averageScore = Double(entries.map { $0.comfortScore }.reduce(0, +)) / Double(entries.count)
        if averageScore < 5 {
            insights.append(Insight(
                type: .comfortTrend,
                title: "Comfort Alert",
                message: "Your average comfort has been low this week.",
                iconName: "eye.fill",
                actionLabel: nil,
                action: nil
            ))
        }

        return insights
    }

    private func checkCheckupReminder() -> [Insight] {
        var insights: [Insight] = []

        let descriptor = FetchDescriptor<DoctorProfile>()

        guard let doctors = try? modelContext.fetch(descriptor),
              let doctor = doctors.first,
              let days = doctor.daysUntilCheckup,
              days >= 0 && days <= 14
        else {
            return insights
        }

        insights.append(Insight(
            type: .checkupReminder,
            title: "Checkup Reminder",
            message: "Your eye checkup is \(Formatters.formatDaysRemaining(days)).",
            iconName: "calendar.badge.clock",
            actionLabel: nil,
            action: nil
        ))

        return insights
    }

    private func saveContext() {
        do {
            try modelContext.save()
        } catch {
            errorMessage = "Failed to save changes"
        }
    }
}
