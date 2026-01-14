import SwiftUI
import SwiftData

struct ReportGeneratorView: View {
    let pdfService: PDFReportService
    @Environment(\.modelContext) private var modelContext
    @Environment(\.dismiss) private var dismiss

    @State private var startDate = Calendar.current.date(byAdding: .month, value: -1, to: Date()) ?? Date()
    @State private var endDate = Date()
    @State private var isGenerating = false
    @State private var generatedReportURL: URL?
    @State private var showingShareSheet = false
    @State private var errorMessage: String?

    var body: some View {
        NavigationStack {
            Form {
                Section("Date Range") {
                    DatePicker(
                        "Start Date",
                        selection: $startDate,
                        in: ...endDate,
                        displayedComponents: .date
                    )

                    DatePicker(
                        "End Date",
                        selection: $endDate,
                        in: startDate...,
                        displayedComponents: .date
                    )
                }

                Section {
                    HStack(spacing: DesignTokens.spacingMedium) {
                        QuickRangeButton(title: "1 Week") {
                            startDate = Calendar.current.date(byAdding: .day, value: -7, to: Date()) ?? Date()
                            endDate = Date()
                        }

                        QuickRangeButton(title: "1 Month") {
                            startDate = Calendar.current.date(byAdding: .month, value: -1, to: Date()) ?? Date()
                            endDate = Date()
                        }

                        QuickRangeButton(title: "3 Months") {
                            startDate = Calendar.current.date(byAdding: .month, value: -3, to: Date()) ?? Date()
                            endDate = Date()
                        }
                    }
                    .listRowBackground(Color.clear)
                } header: {
                    Text("Quick Select")
                }

                Section {
                    VStack(alignment: .leading, spacing: DesignTokens.spacingSmall) {
                        Text("Report Contents")
                            .font(DesignTokens.headlineFont)

                        Group {
                            Label("Wear session summary", systemImage: "clock")
                            Label("Daily and weekly statistics", systemImage: "chart.bar")
                            Label("Comfort score trends", systemImage: "heart")
                            Label("Symptom frequency", systemImage: "list.bullet")
                            Label("Lens profile information", systemImage: "eye")
                        }
                        .font(DesignTokens.captionFont)
                        .foregroundStyle(.secondary)
                    }
                } header: {
                    Text("Preview")
                }

                if let error = errorMessage {
                    Section {
                        Label(error, systemImage: "exclamationmark.triangle")
                            .foregroundStyle(DesignTokens.danger)
                    }
                }
            }
            .navigationTitle("Generate Report")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    Button("Cancel") {
                        dismiss()
                    }
                }

                ToolbarItem(placement: .topBarTrailing) {
                    Button {
                        generateReport()
                    } label: {
                        if isGenerating {
                            ProgressView()
                        } else {
                            Text("Generate")
                        }
                    }
                    .disabled(isGenerating)
                }
            }
            .sheet(isPresented: $showingShareSheet) {
                if let url = generatedReportURL {
                    ShareSheet(activityItems: [url])
                }
            }
        }
    }

    private func generateReport() {
        isGenerating = true
        errorMessage = nil

        Task {
            do {
                let sessions = try fetchSessions()
                let healthEntries = try fetchHealthEntries()
                let lensProfile = try fetchLensProfile()
                let doctorProfile = try fetchDoctorProfile()

                let report = WearReport(
                    startDate: startDate,
                    endDate: endDate,
                    sessions: sessions,
                    healthEntries: healthEntries,
                    lensProfile: lensProfile,
                    doctorProfile: doctorProfile
                )

                let url = try pdfService.generateReportFile(from: report)
                generatedReportURL = url
                showingShareSheet = true
            } catch {
                errorMessage = "Failed to generate report: \(error.localizedDescription)"
            }

            isGenerating = false
        }
    }

    private func fetchSessions() throws -> [WearSession] {
        let descriptor = FetchDescriptor<WearSession>(
            predicate: #Predicate { session in
                session.date >= startDate && session.date <= endDate && !session.isActive
            },
            sortBy: [SortDescriptor(\.date, order: .ascending)]
        )
        return try modelContext.fetch(descriptor)
    }

    private func fetchHealthEntries() throws -> [HealthEntry] {
        let descriptor = FetchDescriptor<HealthEntry>(
            predicate: #Predicate { $0.date >= startDate && $0.date <= endDate },
            sortBy: [SortDescriptor(\.date, order: .ascending)]
        )
        return try modelContext.fetch(descriptor)
    }

    private func fetchLensProfile() throws -> LensProfile? {
        let descriptor = FetchDescriptor<LensProfile>(
            predicate: #Predicate { $0.isActive }
        )
        return try modelContext.fetch(descriptor).first
    }

    private func fetchDoctorProfile() throws -> DoctorProfile? {
        let descriptor = FetchDescriptor<DoctorProfile>()
        return try modelContext.fetch(descriptor).first
    }
}

struct QuickRangeButton: View {
    let title: String
    let action: () -> Void

    var body: some View {
        Button(title, action: action)
            .buttonStyle(.bordered)
            .controlSize(.small)
    }
}

/// UIKit share sheet wrapper
struct ShareSheet: UIViewControllerRepresentable {
    let activityItems: [Any]

    func makeUIViewController(context: Context) -> UIActivityViewController {
        UIActivityViewController(activityItems: activityItems, applicationActivities: nil)
    }

    func updateUIViewController(_ uiViewController: UIActivityViewController, context: Context) {}
}

#Preview {
    ReportGeneratorView(pdfService: PDFReportService())
}
