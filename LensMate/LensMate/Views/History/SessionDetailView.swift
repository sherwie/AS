import SwiftUI

struct SessionDetailView: View {
    let session: WearSession

    var body: some View {
        List {
            Section("Duration") {
                LabeledContent("Start Time", value: Formatters.timeOnly.string(from: session.startTime))

                if let endTime = session.endTime {
                    LabeledContent("End Time", value: Formatters.timeOnly.string(from: endTime))
                }

                LabeledContent("Total Duration", value: session.formattedDuration)
            }

            Section("Details") {
                LabeledContent("Date", value: Formatters.fullDate.string(from: session.date))
                LabeledContent("Source", value: session.source.rawValue)

                if let score = session.comfortScore {
                    LabeledContent("Comfort Score") {
                        ComfortScoreBadge(score: score)
                    }
                }
            }

            if let notes = session.notes, !notes.isEmpty {
                Section("Notes") {
                    Text(notes)
                        .font(DesignTokens.bodyFont)
                }
            }

            if let healthEntry = session.healthEntry {
                Section("Health Log") {
                    LabeledContent("Logged At", value: Formatters.dateWithTime.string(from: healthEntry.timestamp))

                    if !healthEntry.activeSymptoms.isEmpty {
                        VStack(alignment: .leading, spacing: DesignTokens.spacingSmall) {
                            Text("Symptoms")
                                .font(DesignTokens.captionFont)
                                .foregroundStyle(.secondary)

                            SymptomBadgesView(symptoms: healthEntry.activeSymptoms)
                        }
                    }

                    if let notes = healthEntry.notes, !notes.isEmpty {
                        VStack(alignment: .leading, spacing: DesignTokens.spacingSmall) {
                            Text("Health Notes")
                                .font(DesignTokens.captionFont)
                                .foregroundStyle(.secondary)

                            Text(notes)
                                .font(DesignTokens.bodyFont)
                        }
                    }
                }
            }
        }
        .navigationTitle("Session Details")
        .navigationBarTitleDisplayMode(.inline)
    }
}

/// Badge displaying comfort score with color coding
struct ComfortScoreBadge: View {
    let score: Int

    private var scoreColor: Color {
        switch score {
        case 1...3:
            return DesignTokens.danger
        case 4...6:
            return DesignTokens.warning
        case 7...8:
            return DesignTokens.success
        case 9...10:
            return DesignTokens.primaryAction
        default:
            return DesignTokens.warning
        }
    }

    var body: some View {
        Text("\(score)/10")
            .font(DesignTokens.headlineFont)
            .foregroundStyle(scoreColor)
    }
}

#Preview {
    NavigationStack {
        SessionDetailView(
            session: WearSession(
                date: Date(),
                startTime: Date().addingTimeInterval(-3600 * 8),
                endTime: Date(),
                totalDurationSeconds: 3600 * 8,
                source: .iPhone,
                comfortScore: 7,
                notes: "Felt a bit dry towards the end of the day.",
                isActive: false
            )
        )
    }
}
