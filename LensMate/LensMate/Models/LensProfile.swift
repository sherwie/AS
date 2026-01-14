import Foundation
import SwiftData

/// Represents the user's contact lens configuration
@Model
final class LensProfile {
    @Attribute(.unique) var id: UUID
    var lensType: LensType
    var brandName: String?
    var replacementCycleDays: Int
    var currentPairStartDate: Date?
    var isActive: Bool

    init(
        id: UUID = UUID(),
        lensType: LensType = .daily,
        brandName: String? = nil,
        replacementCycleDays: Int? = nil,
        currentPairStartDate: Date? = nil,
        isActive: Bool = true
    ) {
        self.id = id
        self.lensType = lensType
        self.brandName = brandName
        self.replacementCycleDays = replacementCycleDays ?? lensType.defaultCycleDays
        self.currentPairStartDate = currentPairStartDate
        self.isActive = isActive
    }

    /// Calculate the next replacement date based on cycle
    var nextReplacementDate: Date? {
        guard let start = currentPairStartDate else { return nil }
        return Calendar.current.date(byAdding: .day, value: replacementCycleDays, to: start)
    }

    /// Days remaining until replacement is due
    var daysUntilReplacement: Int? {
        guard let nextDate = nextReplacementDate else { return nil }
        let calendar = Calendar.current
        let components = calendar.dateComponents([.day], from: calendar.startOfDay(for: Date()), to: calendar.startOfDay(for: nextDate))
        return components.day
    }

    /// Days the current pair has been used
    var daysUsed: Int {
        guard let start = currentPairStartDate else { return 0 }
        let calendar = Calendar.current
        let components = calendar.dateComponents([.day], from: calendar.startOfDay(for: start), to: calendar.startOfDay(for: Date()))
        return max(0, components.day ?? 0)
    }

    /// Whether the lenses are overdue for replacement
    var isOverdue: Bool {
        guard let days = daysUntilReplacement else { return false }
        return days < 0
    }

    /// Mark lenses as replaced with a new pair
    func replaceLenses() {
        currentPairStartDate = Date()
    }
}

enum LensType: String, Codable, CaseIterable {
    case daily = "Daily"
    case biweekly = "Bi-Weekly"
    case monthly = "Monthly"
    case extended = "Extended Wear"

    var defaultCycleDays: Int {
        switch self {
        case .daily: return 1
        case .biweekly: return 14
        case .monthly: return 30
        case .extended: return 7
        }
    }

    var displayName: String {
        rawValue
    }

    var description: String {
        switch self {
        case .daily:
            return "Replace every day"
        case .biweekly:
            return "Replace every 2 weeks"
        case .monthly:
            return "Replace every month"
        case .extended:
            return "Extended wear up to 7 days"
        }
    }
}
