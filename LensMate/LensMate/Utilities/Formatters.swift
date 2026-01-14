import Foundation

/// Centralized formatters for consistent date and time display
enum Formatters {
    // MARK: - Date Formatters

    /// Full date format: "January 15, 2024"
    static let fullDate: DateFormatter = {
        let formatter = DateFormatter()
        formatter.dateStyle = .long
        formatter.timeStyle = .none
        return formatter
    }()

    /// Short date format: "Jan 15, 2024"
    static let shortDate: DateFormatter = {
        let formatter = DateFormatter()
        formatter.dateStyle = .medium
        formatter.timeStyle = .none
        return formatter
    }()

    /// Compact date format: "1/15/24"
    static let compactDate: DateFormatter = {
        let formatter = DateFormatter()
        formatter.dateStyle = .short
        formatter.timeStyle = .none
        return formatter
    }()

    /// Time only format: "3:45 PM"
    static let timeOnly: DateFormatter = {
        let formatter = DateFormatter()
        formatter.dateStyle = .none
        formatter.timeStyle = .short
        return formatter
    }()

    /// Date with time: "Jan 15 at 3:45 PM"
    static let dateWithTime: DateFormatter = {
        let formatter = DateFormatter()
        formatter.dateFormat = "MMM d 'at' h:mm a"
        return formatter
    }()

    /// Weekday name: "Monday"
    static let weekday: DateFormatter = {
        let formatter = DateFormatter()
        formatter.dateFormat = "EEEE"
        return formatter
    }()

    /// Month and year: "January 2024"
    static let monthYear: DateFormatter = {
        let formatter = DateFormatter()
        formatter.dateFormat = "MMMM yyyy"
        return formatter
    }()

    // MARK: - Duration Formatting

    /// Format seconds into human-readable duration
    /// - Parameter seconds: Total seconds
    /// - Returns: Formatted string like "2h 30m" or "45m"
    static func formatDuration(seconds: Int) -> String {
        let hours = seconds / 3600
        let minutes = (seconds % 3600) / 60

        if hours > 0 {
            return "\(hours)h \(minutes)m"
        } else if minutes > 0 {
            return "\(minutes)m"
        } else {
            return "< 1m"
        }
    }

    /// Format seconds into full duration string
    /// - Parameter seconds: Total seconds
    /// - Returns: Formatted string like "2 hours, 30 minutes"
    static func formatDurationFull(seconds: Int) -> String {
        let hours = seconds / 3600
        let minutes = (seconds % 3600) / 60

        var parts: [String] = []

        if hours > 0 {
            parts.append("\(hours) hour\(hours == 1 ? "" : "s")")
        }
        if minutes > 0 {
            parts.append("\(minutes) minute\(minutes == 1 ? "" : "s")")
        }

        return parts.isEmpty ? "Less than a minute" : parts.joined(separator: ", ")
    }

    /// Format TimeInterval into timer display
    /// - Parameter interval: Time interval in seconds
    /// - Returns: Formatted string like "02:30:45"
    static func formatTimer(interval: TimeInterval) -> String {
        let totalSeconds = Int(interval)
        let hours = totalSeconds / 3600
        let minutes = (totalSeconds % 3600) / 60
        let seconds = totalSeconds % 60

        if hours > 0 {
            return String(format: "%d:%02d:%02d", hours, minutes, seconds)
        } else {
            return String(format: "%02d:%02d", minutes, seconds)
        }
    }

    /// Format hours as decimal
    /// - Parameter seconds: Total seconds
    /// - Returns: Formatted string like "2.5 hours"
    static func formatHoursDecimal(seconds: Int) -> String {
        let hours = Double(seconds) / 3600.0
        return String(format: "%.1f hours", hours)
    }

    // MARK: - Relative Date Formatting

    /// Format date relative to today
    /// - Parameter date: The date to format
    /// - Returns: "Today", "Yesterday", or the formatted date
    static func relativeDate(_ date: Date) -> String {
        let calendar = Calendar.current

        if calendar.isDateInToday(date) {
            return "Today"
        } else if calendar.isDateInYesterday(date) {
            return "Yesterday"
        } else if let daysAgo = calendar.dateComponents([.day], from: date, to: Date()).day, daysAgo < 7 {
            return weekday.string(from: date)
        } else {
            return shortDate.string(from: date)
        }
    }

    /// Format days remaining or overdue
    /// - Parameter days: Number of days (negative for overdue)
    /// - Returns: Formatted string like "in 3 days" or "2 days overdue"
    static func formatDaysRemaining(_ days: Int) -> String {
        if days == 0 {
            return "today"
        } else if days == 1 {
            return "tomorrow"
        } else if days > 1 {
            return "in \(days) days"
        } else if days == -1 {
            return "1 day overdue"
        } else {
            return "\(abs(days)) days overdue"
        }
    }

    // MARK: - Number Formatting

    /// Format percentage
    /// - Parameter value: Value between 0 and 1
    /// - Returns: Formatted percentage string
    static func formatPercentage(_ value: Double) -> String {
        return String(format: "%.0f%%", value * 100)
    }

    /// Format comfort score
    /// - Parameter score: Score from 1-10
    /// - Returns: Formatted string like "8/10"
    static func formatComfortScore(_ score: Int) -> String {
        return "\(score)/10"
    }
}

// MARK: - Date Extensions

extension Date {
    /// Start of the day for this date
    var startOfDay: Date {
        Calendar.current.startOfDay(for: self)
    }

    /// End of the day for this date
    var endOfDay: Date {
        var components = DateComponents()
        components.day = 1
        components.second = -1
        return Calendar.current.date(byAdding: components, to: startOfDay) ?? self
    }

    /// Start of the week for this date
    var startOfWeek: Date {
        let calendar = Calendar.current
        let components = calendar.dateComponents([.yearForWeekOfYear, .weekOfYear], from: self)
        return calendar.date(from: components) ?? self
    }

    /// Start of the month for this date
    var startOfMonth: Date {
        let calendar = Calendar.current
        let components = calendar.dateComponents([.year, .month], from: self)
        return calendar.date(from: components) ?? self
    }

    /// Check if date is in the current week
    var isInCurrentWeek: Bool {
        Calendar.current.isDate(self, equalTo: Date(), toGranularity: .weekOfYear)
    }

    /// Check if date is in the current month
    var isInCurrentMonth: Bool {
        Calendar.current.isDate(self, equalTo: Date(), toGranularity: .month)
    }
}
