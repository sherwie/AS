import SwiftUI

struct SettingsView: View {
    @StateObject var viewModel: SettingsViewModel
    @EnvironmentObject private var appContainer: AppContainer
    @State private var showingDoctorProfile = false
    @State private var showingReportGenerator = false

    var body: some View {
        NavigationStack {
            Form {
                Section("Notifications") {
                    Toggle("Enable Notifications", isOn: $viewModel.notificationsEnabled)
                        .onChange(of: viewModel.notificationsEnabled) { _, newValue in
                            Task {
                                await viewModel.toggleNotifications()
                            }
                        }

                    if viewModel.notificationsEnabled {
                        DatePicker(
                            "Daily Reminder",
                            selection: $viewModel.dailyReminderTime,
                            displayedComponents: .hourAndMinute
                        )

                        Stepper(
                            "Long wear alert: \(viewModel.maxWearHoursAlert)h",
                            value: $viewModel.maxWearHoursAlert,
                            in: 6...16
                        )
                    }
                }

                Section("Health Integration") {
                    if viewModel.isHealthKitAvailable {
                        Toggle("Apple Health", isOn: $viewModel.healthKitEnabled)
                            .onChange(of: viewModel.healthKitEnabled) { _, _ in
                                Task {
                                    await viewModel.toggleHealthKit()
                                }
                            }

                        if viewModel.healthKitEnabled {
                            HStack {
                                Image(systemName: "checkmark.circle.fill")
                                    .foregroundStyle(DesignTokens.success)
                                Text("Connected to Health")
                                    .font(DesignTokens.captionFont)
                                    .foregroundStyle(.secondary)
                            }
                        }
                    } else {
                        HStack {
                            Image(systemName: "exclamationmark.triangle")
                                .foregroundStyle(DesignTokens.warning)
                            Text("Health not available")
                                .foregroundStyle(.secondary)
                        }
                    }
                }

                Section("Preferences") {
                    Toggle("Haptic Feedback", isOn: $viewModel.hapticFeedbackEnabled)
                    Toggle("iCloud Sync", isOn: $viewModel.iCloudSyncEnabled)
                }

                Section("Profiles") {
                    NavigationLink {
                        LensProfileView(viewModel: viewModel)
                    } label: {
                        HStack {
                            Label("Lens Profile", systemImage: "eye.circle")

                            Spacer()

                            if let lens = viewModel.lensProfile {
                                Text(lens.lensType.displayName)
                                    .foregroundStyle(.secondary)
                            }
                        }
                    }

                    Button {
                        showingDoctorProfile = true
                    } label: {
                        HStack {
                            Label("Doctor Profile", systemImage: "stethoscope")

                            Spacer()

                            if let doctor = viewModel.doctorProfile, doctor.hasInformation {
                                Image(systemName: "checkmark.circle.fill")
                                    .foregroundStyle(DesignTokens.success)
                            }

                            Image(systemName: "chevron.right")
                                .font(.caption)
                                .foregroundStyle(.secondary)
                        }
                    }
                    .foregroundStyle(.primary)
                }

                Section("Reports") {
                    Button {
                        showingReportGenerator = true
                    } label: {
                        Label("Generate Report", systemImage: "doc.text")
                    }
                }

                Section("About") {
                    LabeledContent("Version", value: "1.0.0")

                    Link(destination: URL(string: "https://example.com/privacy")!) {
                        Label("Privacy Policy", systemImage: "hand.raised")
                    }

                    Link(destination: URL(string: "https://example.com/support")!) {
                        Label("Support", systemImage: "questionmark.circle")
                    }
                }
            }
            .navigationTitle(AppStrings.Tabs.settings)
            .sheet(isPresented: $showingDoctorProfile) {
                DoctorProfileView(viewModel: viewModel)
            }
            .sheet(isPresented: $showingReportGenerator) {
                ReportGeneratorView(
                    pdfService: appContainer.pdfReportService
                )
            }
            .onAppear {
                viewModel.loadData()
            }
        }
    }
}

#Preview {
    SettingsView(
        viewModel: SettingsViewModel(
            modelContext: try! ModelContainer(for: AppSettings.self).mainContext,
            healthKitService: HealthKitService(),
            notificationService: NotificationService()
        )
    )
    .environmentObject(AppContainer())
}
