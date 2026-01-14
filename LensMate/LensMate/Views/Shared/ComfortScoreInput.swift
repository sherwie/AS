import SwiftUI

/// A slider-based input for comfort scores (1-10)
struct ComfortScoreInput: View {
    @Binding var score: Int
    var showLabel: Bool = true

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

    private var scoreDescription: String {
        switch score {
        case 1...2:
            return "Very Uncomfortable"
        case 3...4:
            return "Uncomfortable"
        case 5...6:
            return "Okay"
        case 7...8:
            return "Comfortable"
        case 9...10:
            return "Very Comfortable"
        default:
            return "Okay"
        }
    }

    var body: some View {
        VStack(spacing: DesignTokens.spacingMedium) {
            if showLabel {
                HStack {
                    Text("Comfort Level")
                        .font(DesignTokens.headlineFont)

                    Spacer()

                    Text("\(score)/10")
                        .font(DesignTokens.title3Font)
                        .foregroundStyle(scoreColor)
                }
            }

            VStack(spacing: DesignTokens.spacingSmall) {
                Slider(
                    value: Binding(
                        get: { Double(score) },
                        set: { score = Int($0.rounded()) }
                    ),
                    in: 1...10,
                    step: 1
                )
                .tint(scoreColor)
                .accessibilityLabel(AppStrings.Accessibility.comfortSlider)
                .accessibilityValue("\(score) out of 10")

                HStack {
                    Text("1")
                        .font(DesignTokens.captionFont)
                        .foregroundStyle(.secondary)

                    Spacer()

                    Text(scoreDescription)
                        .font(DesignTokens.captionFont)
                        .foregroundStyle(scoreColor)

                    Spacer()

                    Text("10")
                        .font(DesignTokens.captionFont)
                        .foregroundStyle(.secondary)
                }
            }
        }
        .padding(DesignTokens.spacingMedium)
        .background(DesignTokens.surfaceSecondary)
        .clipShape(RoundedRectangle(cornerRadius: DesignTokens.cornerRadiusMedium))
    }
}

/// Simplified comfort input for quick entry (1-5 scale)
struct QuickComfortInput: View {
    @Binding var score: Int

    private let emojis = ["😫", "😕", "😐", "🙂", "😊"]

    var body: some View {
        HStack(spacing: DesignTokens.spacingMedium) {
            ForEach(1...5, id: \.self) { value in
                Button {
                    withAnimation(DesignTokens.animationSpring) {
                        score = value * 2
                    }
                } label: {
                    Text(emojis[value - 1])
                        .font(.system(size: 32))
                        .opacity(score / 2 == value ? 1.0 : 0.4)
                        .scaleEffect(score / 2 == value ? 1.2 : 1.0)
                }
                .buttonStyle(.plain)
                .frame(minWidth: DesignTokens.minTouchTarget, minHeight: DesignTokens.minTouchTarget)
            }
        }
    }
}

#Preview("Full Comfort Input") {
    ComfortScoreInput(score: .constant(7))
        .padding()
}

#Preview("Quick Comfort Input") {
    QuickComfortInput(score: .constant(6))
        .padding()
}
