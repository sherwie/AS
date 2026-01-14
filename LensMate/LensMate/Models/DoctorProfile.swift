import Foundation
import SwiftData

/// Stores doctor/eye care provider information and prescription details
@Model
final class DoctorProfile {
    @Attribute(.unique) var id: UUID
    var doctorName: String?
    var clinicName: String?
    var phoneNumber: String?
    var email: String?
    var prescriptionOD: String?
    var prescriptionOS: String?
    var nextCheckupDate: Date?
    var notes: String?

    init(
        id: UUID = UUID(),
        doctorName: String? = nil,
        clinicName: String? = nil,
        phoneNumber: String? = nil,
        email: String? = nil,
        prescriptionOD: String? = nil,
        prescriptionOS: String? = nil,
        nextCheckupDate: Date? = nil,
        notes: String? = nil
    ) {
        self.id = id
        self.doctorName = doctorName
        self.clinicName = clinicName
        self.phoneNumber = phoneNumber
        self.email = email
        self.prescriptionOD = prescriptionOD
        self.prescriptionOS = prescriptionOS
        self.nextCheckupDate = nextCheckupDate
        self.notes = notes
    }

    /// Whether a checkup is scheduled
    var hasUpcomingCheckup: Bool {
        guard let date = nextCheckupDate else { return false }
        return date > Date()
    }

    /// Days until next checkup
    var daysUntilCheckup: Int? {
        guard let date = nextCheckupDate else { return nil }
        let calendar = Calendar.current
        let components = calendar.dateComponents([.day], from: calendar.startOfDay(for: Date()), to: calendar.startOfDay(for: date))
        return components.day
    }

    /// Whether checkup is within a week
    var isCheckupSoon: Bool {
        guard let days = daysUntilCheckup else { return false }
        return days >= 0 && days <= 7
    }

    /// Formatted phone number for display
    var formattedPhoneNumber: String? {
        guard let phone = phoneNumber, !phone.isEmpty else { return nil }
        return phone
    }

    /// Check if profile has any information filled in
    var hasInformation: Bool {
        doctorName != nil ||
        clinicName != nil ||
        phoneNumber != nil ||
        email != nil ||
        prescriptionOD != nil ||
        prescriptionOS != nil
    }
}
