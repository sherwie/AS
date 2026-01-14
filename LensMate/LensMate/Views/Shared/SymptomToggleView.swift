import SwiftUI

/// Individual symptom toggle button
struct SymptomToggle: View {
    let title: String
    let iconName: String
    @Binding var isSelected: Bool

    var body: some View {
        Button {
            withAnimation(DesignTokens.animationSpring) {
                isSelected.toggle()
            }
        } label: {
            HStack(spacing: DesignTokens.spacingSmall) {
                Image(systemName: iconName)
                    .font(.system(size: DesignTokens.iconSizeMedium))

                Text(title)
                    .font(DesignTokens.bodyFont)
            }
            .foregroundStyle(isSelected ? .white : .primary)
            .padding(.horizontal, DesignTokens.spacingMedium)
            .padding(.vertical, DesignTokens.spacingSmall)
            .background(isSelected ? DesignTokens.danger : DesignTokens.surfaceSecondary)
            .clipShape(Capsule())
        }
        .buttonStyle(.plain)
        .accessibilityAddTraits(isSelected ? .isSelected : [])
    }
}

/// Grid of symptom toggles for health logging
struct SymptomToggleView: View {
    @Binding var hasDryness: Bool
    @Binding var hasRedness: Bool
    @Binding var hasIrritation: Bool
    @Binding var hasBurning: Bool

    private let columns = [
        GridItem(.flexible()),
        GridItem(.flexible())
    ]

    var body: some View {
        VStack(alignment: .leading, spacing: DesignTokens.spacingMedium) {
            Text("Symptoms")
                .font(DesignTokens.headlineFont)

            LazyVGrid(columns: columns, spacing: DesignTokens.spacingSmall) {
                SymptomToggle(
                    title: "Dryness",
                    iconName: "drop.fill",
                    isSelected: $hasDryness
                )

                SymptomToggle(
                    title: "Redness",
                    iconName: "eye.fill",
                    isSelected: $hasRedness
                )

                SymptomToggle(
                    title: "Irritation",
                    iconName: "exclamationmark.triangle.fill",
                    isSelected: $hasIrritation
                )

                SymptomToggle(
                    title: "Burning",
                    iconName: "flame.fill",
                    isSelected: $hasBurning
                )
            }

            if hasDryness || hasRedness || hasIrritation || hasBurning {
                HStack {
                    Image(systemName: "info.circle")
                        .foregroundStyle(.secondary)

                    Text("Tap symptoms to toggle")
                        .font(DesignTokens.captionFont)
                        .foregroundStyle(.secondary)
                }
            }
        }
    }
}

/// Compact horizontal symptom display for session details
struct SymptomBadgesView: View {
    let symptoms: [String]

    var body: some View {
        if symptoms.isEmpty {
            Text("No symptoms reported")
                .font(DesignTokens.captionFont)
                .foregroundStyle(.secondary)
        } else {
            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: DesignTokens.spacingSmall) {
                    ForEach(symptoms, id: \.self) { symptom in
                        Text(symptom)
                            .font(DesignTokens.captionFont)
                            .padding(.horizontal, DesignTokens.spacingSmall)
                            .padding(.vertical, DesignTokens.spacingXSmall)
                            .background(DesignTokens.danger.opacity(0.2))
                            .foregroundStyle(DesignTokens.danger)
                            .clipShape(Capsule())
                    }
                }
            }
        }
    }
}

#Preview("Symptom Toggles") {
    SymptomToggleView(
        hasDryness: .constant(true),
        hasRedness: .constant(false),
        hasIrritation: .constant(true),
        hasBurning: .constant(false)
    )
    .padding()
}

#Preview("Symptom Badges") {
    SymptomBadgesView(symptoms: ["Dryness", "Irritation"])
        .padding()
}
