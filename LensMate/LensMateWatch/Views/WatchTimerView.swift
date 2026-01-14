import SwiftUI

/// Dedicated timer view with larger display
struct WatchTimerView: View {
    @ObservedObject var viewModel: WatchViewModel

    var body: some View {
        VStack(spacing: 20) {
            ZStack {
                Circle()
                    .stroke(Color.green.opacity(0.3), lineWidth: 6)

                if viewModel.isWearing {
                    Circle()
                        .trim(from: 0, to: timerProgress)
                        .stroke(Color.green, style: StrokeStyle(lineWidth: 6, lineCap: .round))
                        .rotationEffect(.degrees(-90))
                        .animation(.linear(duration: 1), value: timerProgress)
                }

                VStack(spacing: 4) {
                    if viewModel.isWearing {
                        TimelineView(.periodic(from: .now, by: 1)) { _ in
                            Text(viewModel.formattedElapsedTime)
                                .font(.system(size: 28, weight: .bold, design: .rounded))
                                .monospacedDigit()
                        }

                        Text("wearing")
                            .font(.caption2)
                            .foregroundStyle(.secondary)
                    } else {
                        Image(systemName: "eye.slash")
                            .font(.title2)
                            .foregroundStyle(.secondary)

                        Text("Not wearing")
                            .font(.caption2)
                            .foregroundStyle(.secondary)
                    }
                }
            }
            .frame(width: 140, height: 140)

            Button {
                viewModel.toggleWearing()
            } label: {
                Image(systemName: viewModel.isWearing ? "stop.circle.fill" : "play.circle.fill")
                    .font(.system(size: 44))
                    .foregroundStyle(viewModel.isWearing ? .red : .green)
            }
            .buttonStyle(.plain)
        }
        .navigationTitle("Timer")
    }

    private var timerProgress: Double {
        let maxHours: Double = 12
        let currentHours = viewModel.elapsedTime / 3600
        return min(currentHours / maxHours, 1.0)
    }
}

#Preview {
    WatchTimerView(viewModel: WatchViewModel())
}
