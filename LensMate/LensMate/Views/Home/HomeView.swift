import SwiftUI

struct HomeView: View {
    @StateObject var wearSessionViewModel: WearSessionViewModel
    @StateObject var homeViewModel: HomeViewModel

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: DesignTokens.spacingLarge) {
                    WearTimerView(viewModel: wearSessionViewModel)

                    if let insight = homeViewModel.currentInsight {
                        InsightCardView(insight: insight)
                    }

                    TodaySummaryCard(
                        todayTotal: wearSessionViewModel.formattedTodayTotal,
                        weeklyTotal: homeViewModel.formattedWeeklyTotal
                    )
                }
                .padding(DesignTokens.spacingMedium)
            }
            .background(DesignTokens.surface)
            .navigationTitle(AppStrings.appName)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    if let daysRemaining = homeViewModel.daysUntilReplacement {
                        LensStatusBadge(
                            daysRemaining: daysRemaining,
                            isOverdue: homeViewModel.isOverdue
                        )
                    }
                }
            }
            .sheet(isPresented: $wearSessionViewModel.showComfortPrompt) {
                ComfortLogSheet(viewModel: wearSessionViewModel)
            }
            .onAppear {
                wearSessionViewModel.loadState()
                homeViewModel.loadData()
            }
        }
    }
}

/// Badge showing lens replacement status
struct LensStatusBadge: View {
    let daysRemaining: Int
    let isOverdue: Bool

    private var badgeColor: Color {
        if isOverdue {
            return DesignTokens.danger
        } else if daysRemaining <= 2 {
            return DesignTokens.warning
        } else {
            return DesignTokens.success
        }
    }

    var body: some View {
        HStack(spacing: 4) {
            Image(systemName: "eye.circle.fill")

            if isOverdue {
                Text("Replace")
            } else {
                Text("\(daysRemaining)d")
            }
        }
        .font(DesignTokens.captionFont)
        .foregroundStyle(.white)
        .padding(.horizontal, DesignTokens.spacingSmall)
        .padding(.vertical, DesignTokens.spacingXSmall)
        .background(badgeColor)
        .clipShape(Capsule())
    }
}

/// Summary card for today and weekly totals
struct TodaySummaryCard: View {
    let todayTotal: String
    let weeklyTotal: String

    var body: some View {
        HStack(spacing: DesignTokens.spacingLarge) {
            VStack(alignment: .leading, spacing: DesignTokens.spacingXSmall) {
                Text("Today")
                    .font(DesignTokens.captionFont)
                    .foregroundStyle(.secondary)

                Text(todayTotal)
                    .font(DesignTokens.title2Font)
            }

            Divider()
                .frame(height: 40)

            VStack(alignment: .leading, spacing: DesignTokens.spacingXSmall) {
                Text("This Week")
                    .font(DesignTokens.captionFont)
                    .foregroundStyle(.secondary)

                Text(weeklyTotal)
                    .font(DesignTokens.title2Font)
            }

            Spacer()
        }
        .padding(DesignTokens.spacingMedium)
        .background(DesignTokens.surfaceSecondary)
        .clipShape(RoundedRectangle(cornerRadius: DesignTokens.cornerRadiusMedium))
    }
}

/// Sheet for logging comfort after stopping wear
struct ComfortLogSheet: View {
    @ObservedObject var viewModel: WearSessionViewModel
    @Environment(\.dismiss) private var dismiss

    @State private var comfortScore = AppDefaults.comfortScoreDefault
    @State private var notes = ""

    var body: some View {
        NavigationStack {
            VStack(spacing: DesignTokens.spacingLarge) {
                Text("How did your eyes feel?")
                    .font(DesignTokens.title2Font)
                    .padding(.top, DesignTokens.spacingLarge)

                ComfortScoreInput(score: $comfortScore)

                VStack(alignment: .leading, spacing: DesignTokens.spacingSmall) {
                    Text("Notes (optional)")
                        .font(DesignTokens.headlineFont)

                    TextField("Any observations...", text: $notes, axis: .vertical)
                        .textFieldStyle(.roundedBorder)
                        .lineLimit(3...5)
                }

                Spacer()

                Button {
                    viewModel.stopWearing(comfortScore: comfortScore, notes: notes.isEmpty ? nil : notes)
                    dismiss()
                } label: {
                    Text("Save & Stop")
                        .font(DesignTokens.headlineFont)
                        .foregroundStyle(.white)
                        .frame(maxWidth: .infinity)
                        .padding()
                        .background(DesignTokens.primaryAction)
                        .clipShape(RoundedRectangle(cornerRadius: DesignTokens.cornerRadiusMedium))
                }
            }
            .padding(DesignTokens.spacingMedium)
            .navigationTitle("Log Comfort")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    Button("Skip") {
                        viewModel.stopWearing()
                        dismiss()
                    }
                }
            }
        }
        .presentationDetents([.medium])
    }
}

#Preview {
    HomeView(
        wearSessionViewModel: WearSessionViewModel(
            modelContext: try! ModelContainer(for: WearSession.self).mainContext,
            healthKitService: HealthKitService(),
            watchConnectivityService: WatchConnectivityService(),
            notificationService: NotificationService()
        ),
        homeViewModel: HomeViewModel(
            modelContext: try! ModelContainer(for: WearSession.self).mainContext
        )
    )
}
