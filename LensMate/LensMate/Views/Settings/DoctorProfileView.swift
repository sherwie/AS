import SwiftUI

struct DoctorProfileView: View {
    @ObservedObject var viewModel: SettingsViewModel
    @Environment(\.dismiss) private var dismiss

    @State private var doctorName = ""
    @State private var clinicName = ""
    @State private var phoneNumber = ""
    @State private var email = ""
    @State private var prescriptionOD = ""
    @State private var prescriptionOS = ""
    @State private var nextCheckupDate: Date?
    @State private var hasCheckupDate = false
    @State private var notes = ""

    var body: some View {
        NavigationStack {
            Form {
                Section("Provider Information") {
                    TextField("Doctor Name", text: $doctorName)
                    TextField("Clinic/Practice Name", text: $clinicName)
                }

                Section("Contact") {
                    TextField("Phone Number", text: $phoneNumber)
                        .keyboardType(.phonePad)

                    TextField("Email", text: $email)
                        .keyboardType(.emailAddress)
                        .textInputAutocapitalization(.never)
                }

                Section {
                    HStack {
                        Text("Right Eye (OD)")
                        Spacer()
                        TextField("e.g., -2.50", text: $prescriptionOD)
                            .multilineTextAlignment(.trailing)
                            .frame(width: 100)
                    }

                    HStack {
                        Text("Left Eye (OS)")
                        Spacer()
                        TextField("e.g., -2.75", text: $prescriptionOS)
                            .multilineTextAlignment(.trailing)
                            .frame(width: 100)
                    }
                } header: {
                    Text("Prescription")
                } footer: {
                    Text("Enter your lens power/prescription for reference.")
                }

                Section("Next Checkup") {
                    Toggle("Schedule Reminder", isOn: $hasCheckupDate)

                    if hasCheckupDate {
                        DatePicker(
                            "Date",
                            selection: Binding(
                                get: { nextCheckupDate ?? Date() },
                                set: { nextCheckupDate = $0 }
                            ),
                            in: Date()...,
                            displayedComponents: .date
                        )
                    }
                }

                Section("Notes") {
                    TextField("Additional notes...", text: $notes, axis: .vertical)
                        .lineLimit(3...6)
                }
            }
            .navigationTitle("Doctor Profile")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    Button("Cancel") {
                        dismiss()
                    }
                }

                ToolbarItem(placement: .topBarTrailing) {
                    Button("Save") {
                        saveProfile()
                    }
                }
            }
            .onAppear {
                loadProfile()
            }
        }
    }

    private func loadProfile() {
        guard let profile = viewModel.doctorProfile else { return }

        doctorName = profile.doctorName ?? ""
        clinicName = profile.clinicName ?? ""
        phoneNumber = profile.phoneNumber ?? ""
        email = profile.email ?? ""
        prescriptionOD = profile.prescriptionOD ?? ""
        prescriptionOS = profile.prescriptionOS ?? ""
        nextCheckupDate = profile.nextCheckupDate
        hasCheckupDate = profile.nextCheckupDate != nil
        notes = profile.notes ?? ""
    }

    private func saveProfile() {
        viewModel.saveDoctorProfile(
            doctorName: doctorName.isEmpty ? nil : doctorName,
            clinicName: clinicName.isEmpty ? nil : clinicName,
            phoneNumber: phoneNumber.isEmpty ? nil : phoneNumber,
            email: email.isEmpty ? nil : email,
            prescriptionOD: prescriptionOD.isEmpty ? nil : prescriptionOD,
            prescriptionOS: prescriptionOS.isEmpty ? nil : prescriptionOS,
            nextCheckupDate: hasCheckupDate ? nextCheckupDate : nil,
            notes: notes.isEmpty ? nil : notes
        )
        dismiss()
    }
}

#Preview {
    DoctorProfileView(
        viewModel: SettingsViewModel(
            modelContext: try! ModelContainer(for: DoctorProfile.self).mainContext,
            healthKitService: HealthKitService(),
            notificationService: NotificationService()
        )
    )
}
