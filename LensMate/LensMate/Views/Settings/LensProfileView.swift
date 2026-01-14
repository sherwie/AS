import SwiftUI

struct LensProfileView: View {
    @ObservedObject var viewModel: SettingsViewModel
    @Environment(\.dismiss) private var dismiss

    @State private var lensType: LensType = .monthly
    @State private var brandName = ""
    @State private var customCycleDays = ""
    @State private var hasChanges = false

    var body: some View {
        Form {
            Section {
                Picker("Lens Type", selection: $lensType) {
                    ForEach(LensType.allCases, id: \.self) { type in
                        VStack(alignment: .leading) {
                            Text(type.displayName)
                            Text(type.description)
                                .font(.caption)
                                .foregroundStyle(.secondary)
                        }
                        .tag(type)
                    }
                }
                .pickerStyle(.inline)
            } header: {
                Text("Lens Type")
            } footer: {
                Text("This determines your default replacement schedule.")
            }

            Section("Brand") {
                TextField("Brand name (optional)", text: $brandName)
            }

            Section {
                HStack {
                    Text("Replacement Cycle")
                    Spacer()
                    TextField(
                        "\(lensType.defaultCycleDays)",
                        text: $customCycleDays
                    )
                    .keyboardType(.numberPad)
                    .multilineTextAlignment(.trailing)
                    .frame(width: 60)

                    Text("days")
                        .foregroundStyle(.secondary)
                }
            } footer: {
                Text("Leave blank to use the default cycle for your lens type.")
            }

            if viewModel.lensProfile?.currentPairStartDate != nil {
                Section("Current Pair") {
                    if let startDate = viewModel.lensProfile?.currentPairStartDate {
                        LabeledContent(
                            "Started",
                            value: Formatters.shortDate.string(from: startDate)
                        )
                    }

                    if let nextDate = viewModel.lensProfile?.nextReplacementDate {
                        LabeledContent(
                            "Replace By",
                            value: Formatters.shortDate.string(from: nextDate)
                        )
                    }

                    LabeledContent(
                        "Days Used",
                        value: "\(viewModel.lensProfile?.daysUsed ?? 0)"
                    )
                }
            }
        }
        .navigationTitle("Lens Profile")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                Button("Save") {
                    saveProfile()
                }
                .disabled(!hasChanges)
            }
        }
        .onAppear {
            loadProfile()
        }
        .onChange(of: lensType) { _, _ in hasChanges = true }
        .onChange(of: brandName) { _, _ in hasChanges = true }
        .onChange(of: customCycleDays) { _, _ in hasChanges = true }
    }

    private func loadProfile() {
        guard let profile = viewModel.lensProfile else { return }

        lensType = profile.lensType
        brandName = profile.brandName ?? ""

        if profile.replacementCycleDays != profile.lensType.defaultCycleDays {
            customCycleDays = "\(profile.replacementCycleDays)"
        }
    }

    private func saveProfile() {
        let cycleDays = Int(customCycleDays)
        viewModel.saveLensProfile(
            lensType: lensType,
            brandName: brandName.isEmpty ? nil : brandName,
            replacementCycleDays: cycleDays
        )
        hasChanges = false
        dismiss()
    }
}

#Preview {
    NavigationStack {
        LensProfileView(
            viewModel: SettingsViewModel(
                modelContext: try! ModelContainer(for: AppSettings.self).mainContext,
                healthKitService: HealthKitService(),
                notificationService: NotificationService()
            )
        )
    }
}
