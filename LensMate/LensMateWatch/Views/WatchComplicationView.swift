import SwiftUI
import WidgetKit

/// Circular complication showing wear status
struct CircularComplicationView: View {
    let isWearing: Bool

    var body: some View {
        ZStack {
            Circle()
                .stroke(isWearing ? Color.green.opacity(0.3) : Color.gray.opacity(0.3), lineWidth: 4)

            Circle()
                .fill(isWearing ? Color.green : Color.gray)
                .frame(width: 20, height: 20)

            Image(systemName: isWearing ? "eye.fill" : "eye.slash")
                .font(.system(size: 12))
                .foregroundStyle(.white)
        }
    }
}

/// Rectangular complication showing status and time
struct RectangularComplicationView: View {
    let isWearing: Bool
    let elapsedTime: String

    var body: some View {
        HStack(spacing: 8) {
            Image(systemName: isWearing ? "eye.fill" : "eye.slash")
                .font(.title3)
                .foregroundStyle(isWearing ? .green : .gray)

            VStack(alignment: .leading, spacing: 2) {
                Text(isWearing ? "Wearing" : "Not Wearing")
                    .font(.caption)
                    .foregroundStyle(.primary)

                if isWearing {
                    Text(elapsedTime)
                        .font(.caption2)
                        .foregroundStyle(.secondary)
                }
            }
        }
    }
}

/// Corner complication
struct CornerComplicationView: View {
    let isWearing: Bool

    var body: some View {
        Image(systemName: isWearing ? "eye.fill" : "eye.slash")
            .font(.title3)
            .foregroundStyle(isWearing ? .green : .gray)
    }
}

/// Inline complication
struct InlineComplicationView: View {
    let isWearing: Bool
    let elapsedTime: String

    var body: some View {
        HStack(spacing: 4) {
            Image(systemName: isWearing ? "eye.fill" : "eye.slash")

            if isWearing {
                Text(elapsedTime)
            } else {
                Text("Not wearing")
            }
        }
        .font(.caption)
    }
}

#Preview("Circular - Wearing") {
    CircularComplicationView(isWearing: true)
        .frame(width: 50, height: 50)
}

#Preview("Circular - Not Wearing") {
    CircularComplicationView(isWearing: false)
        .frame(width: 50, height: 50)
}

#Preview("Rectangular - Wearing") {
    RectangularComplicationView(isWearing: true, elapsedTime: "2:30:45")
        .frame(width: 150, height: 50)
}

#Preview("Rectangular - Not Wearing") {
    RectangularComplicationView(isWearing: false, elapsedTime: "")
        .frame(width: 150, height: 50)
}
