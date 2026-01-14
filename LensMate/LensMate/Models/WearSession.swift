import Foundation
import SwiftData

/// Represents a single contact lens wear session
@Model
final class WearSession {
    @Attribute(.unique) var id: UUID
    var date: Date
    var startTime: Date
    var endTime: Date?
    var totalDurationSeconds: Int
    var source: SessionSource
    var comfortScore: Int?
    var notes: String?
    var isActive: Bool

    @Relationship(deleteRule: .nullify, inverse: \HealthEntry.wearSession)
    var healthEntry: HealthEntry?

    init(
        id: UUID = UUID(),
        date: Date = Date(),
        startTime: Date = Date(),
        endTime: Date? = nil,
        totalDurationSeconds: Int = 0,
        source: SessionSource = .iPhone,
        comfortScore: Int? = nil,
        notes: String? = nil,
        isActive: Bool = true,
        healthEntry: HealthEntry? = nil
    ) {
        self.id = id
        self.date = date
        self.startTime = startTime
        self.endTime = endTime
        self.totalDurationSeconds = totalDurationSeconds
        self.source = source
        self.comfortScore = comfortScore
        self.notes = notes
        self.isActive = isActive
        self.healthEntry = healthEntry
    }

    /// Calculate elapsed time from dates, not timers
    var elapsedTime: TimeInterval {
        let end = endTime ?? Date()
        return end.timeIntervalSince(startTime)
    }

    /// Formatted duration string
    var formattedDuration: String {
        let seconds = endTime != nil ? totalDurationSeconds : Int(elapsedTime)
        let hours = seconds / 3600
        let minutes = (seconds % 3600) / 60

        if hours > 0 {
            return "\(hours)h \(minutes)m"
        } else {
            return "\(minutes)m"
        }
    }

    /// End the current session
    func endSession(comfortScore: Int? = nil, notes: String? = nil) {
        self.endTime = Date()
        self.totalDurationSeconds = Int(elapsedTime)
        self.isActive = false
        self.comfortScore = comfortScore
        self.notes = notes
    }
}

enum SessionSource: String, Codable, CaseIterable {
    case iPhone = "iPhone"
    case watch = "Apple Watch"
}
