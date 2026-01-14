import Foundation
import UserNotifications

/// Types of notifications the app can send
enum NotificationType: String, CaseIterable {
    case replaceLenses = "REPLACE_LENSES"
    case longWearAlert = "LONG_WEAR_ALERT"
    case endOfDayReminder = "END_OF_DAY_REMINDER"
    case lowInventory = "LOW_INVENTORY"
    case checkupReminder = "CHECKUP_REMINDER"

    var title: String {
        switch self {
        case .replaceLenses:
            return "Time to Replace"
        case .longWearAlert:
            return "Extended Wear Alert"
        case .endOfDayReminder:
            return "Daily Reminder"
        case .lowInventory:
            return "Low Stock Alert"
        case .checkupReminder:
            return "Checkup Reminder"
        }
    }

    var categoryIdentifier: String {
        rawValue
    }
}

/// Manages local notifications for reminders and alerts
@MainActor
final class NotificationService: ObservableObject {
    private let center = UNUserNotificationCenter.current()

    @Published private(set) var isAuthorized = false
    @Published private(set) var authorizationStatus: UNAuthorizationStatus = .notDetermined

    init() {
        Task {
            await checkAuthorizationStatus()
        }
    }

    /// Request notification authorization
    func requestAuthorization() async throws -> Bool {
        do {
            let granted = try await center.requestAuthorization(options: [.alert, .sound, .badge])
            isAuthorized = granted
            await checkAuthorizationStatus()
            if granted {
                await registerCategories()
            }
            return granted
        } catch {
            throw NotificationError.authorizationFailed(error)
        }
    }

    /// Check current authorization status
    func checkAuthorizationStatus() async {
        let settings = await center.notificationSettings()
        authorizationStatus = settings.authorizationStatus
        isAuthorized = settings.authorizationStatus == .authorized
    }

    /// Register notification categories with actions
    private func registerCategories() async {
        let stopWearAction = UNNotificationAction(
            identifier: "STOP_WEAR",
            title: "Stop Wearing",
            options: .foreground
        )

        let dismissAction = UNNotificationAction(
            identifier: "DISMISS",
            title: "Dismiss",
            options: .destructive
        )

        let longWearCategory = UNNotificationCategory(
            identifier: NotificationType.longWearAlert.categoryIdentifier,
            actions: [stopWearAction, dismissAction],
            intentIdentifiers: []
        )

        let replaceAction = UNNotificationAction(
            identifier: "MARK_REPLACED",
            title: "Mark as Replaced",
            options: .foreground
        )

        let replaceCategory = UNNotificationCategory(
            identifier: NotificationType.replaceLenses.categoryIdentifier,
            actions: [replaceAction, dismissAction],
            intentIdentifiers: []
        )

        center.setNotificationCategories([longWearCategory, replaceCategory])
    }

    /// Schedule a lens replacement reminder
    func scheduleReplacementReminder(daysRemaining: Int, lensType: String) async throws {
        guard isAuthorized else {
            throw NotificationError.notAuthorized
        }

        let content = UNMutableNotificationContent()
        content.title = NotificationType.replaceLenses.title
        content.body = daysRemaining <= 0
            ? "Your \(lensType) lenses should be replaced today."
            : "Replace your \(lensType) lenses in \(daysRemaining) day\(daysRemaining == 1 ? "" : "s")."
        content.sound = .default
        content.categoryIdentifier = NotificationType.replaceLenses.categoryIdentifier

        var dateComponents = DateComponents()
        dateComponents.hour = 9
        dateComponents.minute = 0

        let trigger = UNCalendarNotificationTrigger(dateMatching: dateComponents, repeats: false)

        let request = UNNotificationRequest(
            identifier: "\(NotificationType.replaceLenses.rawValue)_\(UUID().uuidString)",
            content: content,
            trigger: trigger
        )

        try await center.add(request)
    }

    /// Schedule a long wear alert
    func scheduleLongWearAlert(afterHours hours: Int) async throws {
        guard isAuthorized else {
            throw NotificationError.notAuthorized
        }

        let content = UNMutableNotificationContent()
        content.title = NotificationType.longWearAlert.title
        content.body = "You've been wearing your lenses for \(hours) hours. Consider taking a break."
        content.sound = .default
        content.categoryIdentifier = NotificationType.longWearAlert.categoryIdentifier

        let trigger = UNTimeIntervalNotificationTrigger(
            timeInterval: TimeInterval(hours * 3600),
            repeats: false
        )

        let request = UNNotificationRequest(
            identifier: NotificationType.longWearAlert.rawValue,
            content: content,
            trigger: trigger
        )

        try await center.add(request)
    }

    /// Schedule a daily end-of-day reminder
    func scheduleEndOfDayReminder(at time: DateComponents) async throws {
        guard isAuthorized else {
            throw NotificationError.notAuthorized
        }

        await cancelNotifications(ofType: .endOfDayReminder)

        let content = UNMutableNotificationContent()
        content.title = NotificationType.endOfDayReminder.title
        content.body = "Don't forget to remove your contact lenses before bed."
        content.sound = .default

        let trigger = UNCalendarNotificationTrigger(dateMatching: time, repeats: true)

        let request = UNNotificationRequest(
            identifier: NotificationType.endOfDayReminder.rawValue,
            content: content,
            trigger: trigger
        )

        try await center.add(request)
    }

    /// Schedule a low inventory alert
    func scheduleLowInventoryAlert(unitsRemaining: Int) async throws {
        guard isAuthorized else {
            throw NotificationError.notAuthorized
        }

        let content = UNMutableNotificationContent()
        content.title = NotificationType.lowInventory.title
        content.body = "Only \(unitsRemaining) pair\(unitsRemaining == 1 ? "" : "s") of lenses remaining. Time to reorder!"
        content.sound = .default

        let request = UNNotificationRequest(
            identifier: NotificationType.lowInventory.rawValue,
            content: content,
            trigger: nil
        )

        try await center.add(request)
    }

    /// Schedule a checkup reminder
    func scheduleCheckupReminder(date: Date, doctorName: String?) async throws {
        guard isAuthorized else {
            throw NotificationError.notAuthorized
        }

        let reminderDate = Calendar.current.date(byAdding: .day, value: -7, to: date) ?? date

        let content = UNMutableNotificationContent()
        content.title = NotificationType.checkupReminder.title
        if let name = doctorName {
            content.body = "Your eye checkup with \(name) is in one week."
        } else {
            content.body = "Your eye checkup is in one week."
        }
        content.sound = .default

        var dateComponents = Calendar.current.dateComponents([.year, .month, .day], from: reminderDate)
        dateComponents.hour = 10
        dateComponents.minute = 0

        let trigger = UNCalendarNotificationTrigger(dateMatching: dateComponents, repeats: false)

        let request = UNNotificationRequest(
            identifier: "\(NotificationType.checkupReminder.rawValue)_\(date.timeIntervalSince1970)",
            content: content,
            trigger: trigger
        )

        try await center.add(request)
    }

    /// Cancel notifications of a specific type
    func cancelNotifications(ofType type: NotificationType) async {
        let pendingRequests = await center.pendingNotificationRequests()
        let identifiersToRemove = pendingRequests
            .filter { $0.identifier.hasPrefix(type.rawValue) }
            .map { $0.identifier }

        center.removePendingNotificationRequests(withIdentifiers: identifiersToRemove)
    }

    /// Cancel all pending notifications
    func cancelAllNotifications() {
        center.removeAllPendingNotificationRequests()
    }

    /// Cancel the long wear alert (when user stops wearing)
    func cancelLongWearAlert() {
        center.removePendingNotificationRequests(withIdentifiers: [NotificationType.longWearAlert.rawValue])
    }
}

enum NotificationError: LocalizedError {
    case notAuthorized
    case authorizationFailed(Error)
    case scheduleFailed(Error)

    var errorDescription: String? {
        switch self {
        case .notAuthorized:
            return "Please enable notifications in Settings to receive reminders."
        case .authorizationFailed(let error):
            return "Failed to authorize notifications: \(error.localizedDescription)"
        case .scheduleFailed(let error):
            return "Failed to schedule notification: \(error.localizedDescription)"
        }
    }
}
