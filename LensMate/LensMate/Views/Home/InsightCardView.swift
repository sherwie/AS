import SwiftUI

/// Card displaying a single prioritized insight
struct InsightCardView: View {
    let insight: Insight

    private var iconColor: Color {
        switch insight.type {
        case .replaceNow, .highWearWarning:
            return DesignTokens.warning
        case .comfortTrend:
            return DesignTokens.danger
        case .lowInventory:
            return DesignTokens.warning
        case .checkupReminder:
            return DesignTokens.primaryAction
        }
    }

    private var backgroundColor: Color {
        iconColor.opacity(0.1)
    }

    var body: some View {
        HStack(spacing: DesignTokens.spacingMedium) {
            Image(systemName: insight.iconName)
                .font(.system(size: DesignTokens.iconSizeLarge))
                .foregroundStyle(iconColor)
                .frame(width: 44, height: 44)
                .background(iconColor.opacity(0.2))
                .clipShape(Circle())

            VStack(alignment: .leading, spacing: DesignTokens.spacingXSmall) {
                Text(insight.title)
                    .font(DesignTokens.headlineFont)

                Text(insight.message)
                    .font(DesignTokens.bodyFont)
                    .foregroundStyle(.secondary)
                    .lineLimit(2)
            }

            Spacer()

            if let actionLabel = insight.actionLabel, let action = insight.action {
                Button(actionLabel) {
                    action()
                }
                .font(DesignTokens.captionFont)
                .buttonStyle(.borderedProminent)
                .controlSize(.small)
            }
        }
        .padding(DesignTokens.spacingMedium)
        .background(backgroundColor)
        .clipShape(RoundedRectangle(cornerRadius: DesignTokens.cornerRadiusMedium))
        .overlay(
            RoundedRectangle(cornerRadius: DesignTokens.cornerRadiusMedium)
                .stroke(iconColor.opacity(0.3), lineWidth: 1)
        )
    }
}

#Preview("Replace Insight") {
    InsightCardView(
        insight: Insight(
            type: .replaceNow,
            title: "Time to Replace",
            message: "Your bi-weekly lenses should be replaced now.",
            iconName: "exclamationmark.triangle.fill",
            actionLabel: "Mark Replaced",
            action: {}
        )
    )
    .padding()
}

#Preview("Low Inventory Insight") {
    InsightCardView(
        insight: Insight(
            type: .lowInventory,
            title: "Low Stock",
            message: "Only 3 pairs remaining.",
            iconName: "shippingbox.fill",
            actionLabel: nil,
            action: nil
        )
    )
    .padding()
}

#Preview("Comfort Trend Insight") {
    InsightCardView(
        insight: Insight(
            type: .comfortTrend,
            title: "Comfort Alert",
            message: "Your average comfort has been low this week.",
            iconName: "eye.fill",
            actionLabel: nil,
            action: nil
        )
    )
    .padding()
}
