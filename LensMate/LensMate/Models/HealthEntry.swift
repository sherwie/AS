import Foundation
import SwiftData

/// Represents an eye health log entry
@Model
final class HealthEntry {
    @Attribute(.unique) var id: UUID
    var date: Date
    var comfortScore: Int
    var hasDryness: Bool
    var hasRedness: Bool
    var hasIrritation: Bool
    var hasBurning: Bool
    var notes: String?
    var timestamp: Date

    var wearSession: WearSession?

    init(
        id: UUID = UUID(),
        date: Date = Date(),
        comfortScore: Int = 5,
        hasDryness: Bool = false,
        hasRedness: Bool = false,
        hasIrritation: Bool = false,
        hasBurning: Bool = false,
        notes: String? = nil,
        timestamp: Date = Date(),
        wearSession: WearSession? = nil
    ) {
        self.id = id
        self.date = date
        self.comfortScore = comfortScore
        self.hasDryness = hasDryness
        self.hasRedness = hasRedness
        self.hasIrritation = hasIrritation
        self.hasBurning = hasBurning
        self.notes = notes
        self.timestamp = timestamp
        self.wearSession = wearSession
    }

    /// Returns active symptoms as an array of strings
    var activeSymptoms: [String] {
        var symptoms: [String] = []
        if hasDryness { symptoms.append("Dryness") }
        if hasRedness { symptoms.append("Redness") }
        if hasIrritation { symptoms.append("Irritation") }
        if hasBurning { symptoms.append("Burning") }
        return symptoms
    }

    /// Returns true if any symptoms are present
    var hasSymptoms: Bool {
        hasDryness || hasRedness || hasIrritation || hasBurning
    }

    /// Comfort level description
    var comfortLevel: ComfortLevel {
        switch comfortScore {
        case 1...3:
            return .poor
        case 4...6:
            return .moderate
        case 7...8:
            return .good
        case 9...10:
            return .excellent
        default:
            return .moderate
        }
    }
}

enum ComfortLevel: String, CaseIterable {
    case poor = "Poor"
    case moderate = "Moderate"
    case good = "Good"
    case excellent = "Excellent"

    var color: String {
        switch self {
        case .poor: return "red"
        case .moderate: return "orange"
        case .good: return "green"
        case .excellent: return "blue"
        }
    }
}
