import SwiftUI

/// Main wear tracking control with timer display
struct WearTimerView: View {
    @ObservedObject var viewModel: WearSessionViewModel

    var body: some View {
        VStack(spacing: DesignTokens.spacingLarge) {
            ZStack {
                Circle()
                    .stroke(
                        viewModel.isWearing ? DesignTokens.success.opacity(0.3) : DesignTokens.surfaceSecondary,
                        lineWidth: 8
                    )
                    .frame(width: 200, height: 200)

                if viewModel.isWearing {
                    Circle()
                        .trim(from: 0, to: timerProgress)
                        .stroke(
                            DesignTokens.success,
                            style: StrokeStyle(lineWidth: 8, lineCap: .round)
                        )
                        .frame(width: 200, height: 200)
                        .rotationEffect(.degrees(-90))
                        .animation(.linear(duration: 1), value: timerProgress)
                }

                VStack(spacing: DesignTokens.spacingSmall) {
                    Text(viewModel.isWearing ? AppStrings.WearStatus.wearing : AppStrings.WearStatus.notWearing)
                        .font(DesignTokens.captionFont)
                        .foregroundStyle(.secondary)
                        .textCase(.uppercase)

                    if viewModel.isWearing {
                        TimelineView(.periodic(from: .now, by: 1)) { _ in
                            Text(viewModel.formattedElapsedTime)
                                .font(.system(size: 36, weight: .semibold, design: .rounded))
                                .monospacedDigit()
                                .contentTransition(.numericText())
                        }
                        .accessibilityLabel(AppStrings.Accessibility.timerDisplay)
                    } else {
                        Text("--:--")
                            .font(.system(size: 36, weight: .semibold, design: .rounded))
                            .foregroundStyle(.secondary)
                    }
                }
            }

            WearToggleButton(
                isWearing: viewModel.isWearing,
                action: viewModel.toggleWearing
            )
        }
        .padding(DesignTokens.spacingLarge)
        .background(DesignTokens.surfaceSecondary)
        .clipShape(RoundedRectangle(cornerRadius: DesignTokens.cornerRadiusLarge))
    }

    private var timerProgress: Double {
        let maxHours: Double = 12
        let currentHours = viewModel.elapsedTime / 3600
        return min(currentHours / maxHours, 1.0)
    }
}

/// Large toggle button for starting/stopping wear
struct WearToggleButton: View {
    let isWearing: Bool
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            HStack(spacing: DesignTokens.spacingSmall) {
                Image(systemName: isWearing ? "stop.fill" : "play.fill")
                    .font(.system(size: DesignTokens.iconSizeMedium))

                Text(isWearing ? AppStrings.WearStatus.stopWear : AppStrings.WearStatus.startWear)
                    .font(DesignTokens.headlineFont)
            }
            .foregroundStyle(.white)
            .frame(maxWidth: .infinity)
            .padding()
            .background(isWearing ? DesignTokens.danger : DesignTokens.success)
            .clipShape(RoundedRectangle(cornerRadius: DesignTokens.cornerRadiusMedium))
        }
        .accessibilityLabel(isWearing ? AppStrings.Accessibility.stopWearButton : AppStrings.Accessibility.startWearButton)
        .sensoryFeedback(.impact, trigger: isWearing)
    }
}

#Preview("Not Wearing") {
    WearTimerView(
        viewModel: WearSessionViewModel(
            modelContext: try! ModelContainer(for: WearSession.self).mainContext,
            healthKitService: HealthKitService(),
            watchConnectivityService: WatchConnectivityService(),
            notificationService: NotificationService()
        )
    )
    .padding()
}
