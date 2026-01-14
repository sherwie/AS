import Foundation
import SwiftData
import Combine

/// Manages app settings and user profiles
@MainActor
final class SettingsViewModel: ObservableObject {
    @Published var settings: AppSettings?
    @Published var doctorProfile: DoctorProfile?
    @Published var lensProfile: LensProfile?
    @Published var errorMessage: String?

    @Published var notificationsEnabled = true
    @Published var healthKitEnabled = false
    @Published var iCloudSyncEnabled = true
    @Published var dailyReminderTime: Date = AppSettings.defaultReminderTime
    @Published var maxWearHoursAlert = AppDefaults.maxWearHoursDefault
    @Published var hapticFeedbackEnabled = true

    private let modelContext: ModelContext
    private let healthKitService: HealthKitService
    private let notificationService: NotificationService
    private var cancellables = Set<AnyCancellable>()

    init(
        modelContext: ModelContext,
        healthKitService: HealthKitService,
        notificationService: NotificationService
    ) {
        self.modelContext = modelContext
        self.healthKitService = healthKitService
        self.notificationService = notificationService

        setupBindings()
    }

    /// Load settings data
    func loadData() {
        fetchSettings()
        fetchDoctorProfile()
        fetchLensProfile()
        syncUIWithSettings()
    }

    /// Save settings changes
    func saveSettings() {
        guard let settings = settings else {
            createSettings()
            return
        }

        settings.notificationsEnabled = notificationsEnabled
        settings.healthKitEnabled = healthKitEnabled
        settings.iCloudSyncEnabled = iCloudSyncEnabled
        settings.dailyReminderTime = dailyReminderTime
        settings.maxWearHoursAlert = maxWearHoursAlert
        settings.hapticFeedbackEnabled = hapticFeedbackEnabled

        saveContext()
        updateNotifications()
    }

    /// Toggle HealthKit integration
    func toggleHealthKit() async {
        if !healthKitEnabled {
            do {
                try await healthKitService.requestAuthorization()
                healthKitEnabled = healthKitService.isAuthorized
            } catch {
                errorMessage = error.localizedDescription
                healthKitEnabled = false
            }
        } else {
            healthKitEnabled = false
        }
        saveSettings()
    }

    /// Toggle notifications
    func toggleNotifications() async {
        if !notificationsEnabled {
            do {
                let granted = try await notificationService.requestAuthorization()
                notificationsEnabled = granted
            } catch {
                errorMessage = error.localizedDescription
                notificationsEnabled = false
            }
        } else {
            notificationsEnabled = false
            notificationService.cancelAllNotifications()
        }
        saveSettings()
    }

    /// Save doctor profile
    func saveDoctorProfile(
        doctorName: String?,
        clinicName: String?,
        phoneNumber: String?,
        email: String?,
        prescriptionOD: String?,
        prescriptionOS: String?,
        nextCheckupDate: Date?,
        notes: String?
    ) {
        if let profile = doctorProfile {
            profile.doctorName = doctorName
            profile.clinicName = clinicName
            profile.phoneNumber = phoneNumber
            profile.email = email
            profile.prescriptionOD = prescriptionOD
            profile.prescriptionOS = prescriptionOS
            profile.nextCheckupDate = nextCheckupDate
            profile.notes = notes
        } else {
            let profile = DoctorProfile(
                doctorName: doctorName,
                clinicName: clinicName,
                phoneNumber: phoneNumber,
                email: email,
                prescriptionOD: prescriptionOD,
                prescriptionOS: prescriptionOS,
                nextCheckupDate: nextCheckupDate,
                notes: notes
            )
            modelContext.insert(profile)
            doctorProfile = profile
        }

        saveContext()
        scheduleCheckupReminder()
    }

    /// Save lens profile
    func saveLensProfile(
        lensType: LensType,
        brandName: String?,
        replacementCycleDays: Int?
    ) {
        if let profile = lensProfile {
            profile.lensType = lensType
            profile.brandName = brandName
            profile.replacementCycleDays = replacementCycleDays ?? lensType.defaultCycleDays
        } else {
            let profile = LensProfile(
                lensType: lensType,
                brandName: brandName,
                replacementCycleDays: replacementCycleDays,
                currentPairStartDate: Date(),
                isActive: true
            )
            modelContext.insert(profile)
            lensProfile = profile
        }

        saveContext()
    }

    /// HealthKit availability
    var isHealthKitAvailable: Bool {
        healthKitService.isAvailable
    }

    /// HealthKit authorization status
    var isHealthKitAuthorized: Bool {
        healthKitService.isAuthorized
    }

    // MARK: - Private Methods

    private func setupBindings() {
        $notificationsEnabled
            .dropFirst()
            .debounce(for: .milliseconds(500), scheduler: DispatchQueue.main)
            .sink { [weak self] _ in self?.saveSettings() }
            .store(in: &cancellables)

        $dailyReminderTime
            .dropFirst()
            .debounce(for: .milliseconds(500), scheduler: DispatchQueue.main)
            .sink { [weak self] _ in self?.saveSettings() }
            .store(in: &cancellables)

        $maxWearHoursAlert
            .dropFirst()
            .debounce(for: .milliseconds(500), scheduler: DispatchQueue.main)
            .sink { [weak self] _ in self?.saveSettings() }
            .store(in: &cancellables)

        $hapticFeedbackEnabled
            .dropFirst()
            .debounce(for: .milliseconds(500), scheduler: DispatchQueue.main)
            .sink { [weak self] _ in self?.saveSettings() }
            .store(in: &cancellables)
    }

    private func fetchSettings() {
        let descriptor = FetchDescriptor<AppSettings>()

        do {
            let allSettings = try modelContext.fetch(descriptor)
            settings = allSettings.first

            if settings == nil {
                createSettings()
            }
        } catch {
            errorMessage = "Failed to load settings"
        }
    }

    private func createSettings() {
        let newSettings = AppSettings(
            notificationsEnabled: notificationsEnabled,
            healthKitEnabled: healthKitEnabled,
            iCloudSyncEnabled: iCloudSyncEnabled,
            dailyReminderTime: dailyReminderTime,
            maxWearHoursAlert: maxWearHoursAlert,
            hapticFeedbackEnabled: hapticFeedbackEnabled
        )
        modelContext.insert(newSettings)
        settings = newSettings
        saveContext()
    }

    private func fetchDoctorProfile() {
        let descriptor = FetchDescriptor<DoctorProfile>()

        do {
            let profiles = try modelContext.fetch(descriptor)
            doctorProfile = profiles.first
        } catch {
            errorMessage = "Failed to load doctor profile"
        }
    }

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

    private func syncUIWithSettings() {
        guard let settings = settings else { return }

        notificationsEnabled = settings.notificationsEnabled
        healthKitEnabled = settings.healthKitEnabled
        iCloudSyncEnabled = settings.iCloudSyncEnabled
        dailyReminderTime = settings.dailyReminderTime ?? AppSettings.defaultReminderTime
        maxWearHoursAlert = settings.maxWearHoursAlert
        hapticFeedbackEnabled = settings.hapticFeedbackEnabled
    }

    private func updateNotifications() {
        guard notificationsEnabled else {
            notificationService.cancelAllNotifications()
            return
        }

        let components = Calendar.current.dateComponents([.hour, .minute], from: dailyReminderTime)

        Task {
            try? await notificationService.scheduleEndOfDayReminder(at: components)
        }
    }

    private func scheduleCheckupReminder() {
        guard let date = doctorProfile?.nextCheckupDate,
              date > Date()
        else { return }

        Task {
            try? await notificationService.scheduleCheckupReminder(
                date: date,
                doctorName: doctorProfile?.doctorName
            )
        }
    }

    private func saveContext() {
        do {
            try modelContext.save()
        } catch {
            errorMessage = "Failed to save settings"
        }
    }
}
