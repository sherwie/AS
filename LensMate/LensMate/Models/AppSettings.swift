import Foundation
import SwiftData

/// Stores user preferences and app configuration
@Model
final class AppSettings {
    @Attribute(.unique) var id: UUID
    var notificationsEnabled: Bool
    var healthKitEnabled: Bool
    var iCloudSyncEnabled: Bool
    var dailyReminderTime: Date?
    var maxWearHoursAlert: Int
    var hapticFeedbackEnabled: Bool

    init(
        id: UUID = UUID(),
        notificationsEnabled: Bool = true,
        healthKitEnabled: Bool = false,
        iCloudSyncEnabled: Bool = true,
        dailyReminderTime: Date? = nil,
        maxWearHoursAlert: Int = 12,
        hapticFeedbackEnabled: Bool = true
    ) {
        self.id = id
        self.notificationsEnabled = notificationsEnabled
        self.healthKitEnabled = healthKitEnabled
        self.iCloudSyncEnabled = iCloudSyncEnabled
        self.dailyReminderTime = dailyReminderTime
        self.maxWearHoursAlert = maxWearHoursAlert
        self.hapticFeedbackEnabled = hapticFeedbackEnabled
    }

    /// Default reminder time (8:00 PM)
    static var defaultReminderTime: Date {
        var components = DateComponents()
        components.hour = 20
        components.minute = 0
        return Calendar.current.date(from: components) ?? Date()
    }

    /// Time component only for daily reminder
    var reminderTimeOfDay: DateComponents? {
        guard let time = dailyReminderTime else { return nil }
        return Calendar.current.dateComponents([.hour, .minute], from: time)
    }

    /// Formatted reminder time string
    var formattedReminderTime: String? {
        guard let time = dailyReminderTime else { return nil }
        let formatter = DateFormatter()
        formatter.timeStyle = .short
        return formatter.string(from: time)
    }
}
