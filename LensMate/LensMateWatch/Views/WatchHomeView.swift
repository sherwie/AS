import SwiftUI

struct WatchHomeView: View {
    @ObservedObject var viewModel: WatchViewModel

    var body: some View {
        NavigationStack {
            VStack(spacing: 12) {
                StatusIndicator(isWearing: viewModel.isWearing)

                if viewModel.isWearing {
                    TimelineView(.periodic(from: .now, by: 1)) { _ in
                        Text(viewModel.formattedElapsedTime)
                            .font(.system(size: 36, weight: .semibold, design: .rounded))
                            .monospacedDigit()
                            .foregroundStyle(.primary)
                    }
                }

                WatchToggleButton(
                    isWearing: viewModel.isWearing,
                    action: viewModel.toggleWearing
                )
            }
            .padding()
            .navigationTitle("LensMate")
            .navigationBarTitleDisplayMode(.inline)
            .sheet(isPresented: $viewModel.showingComfortPrompt) {
                WatchComfortSheet(viewModel: viewModel)
            }
        }
    }
}

/// Status indicator showing current wear state
struct StatusIndicator: View {
    let isWearing: Bool

    var body: some View {
        HStack(spacing: 6) {
            Circle()
                .fill(isWearing ? Color.green : Color.gray)
                .frame(width: 8, height: 8)

            Text(isWearing ? "Wearing" : "Not Wearing")
                .font(.caption)
                .foregroundStyle(.secondary)
        }
    }
}

/// Large toggle button for watch
struct WatchToggleButton: View {
    let isWearing: Bool
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            HStack {
                Image(systemName: isWearing ? "stop.fill" : "play.fill")
                Text(isWearing ? "Stop" : "Start")
            }
            .font(.headline)
            .foregroundStyle(.white)
            .frame(maxWidth: .infinity)
            .padding(.vertical, 12)
            .background(isWearing ? Color.red : Color.green)
            .clipShape(RoundedRectangle(cornerRadius: 12))
        }
        .buttonStyle(.plain)
    }
}

/// Comfort rating sheet for watch
struct WatchComfortSheet: View {
    @ObservedObject var viewModel: WatchViewModel
    @Environment(\.dismiss) private var dismiss

    @State private var selectedScore = 3

    private let emojis = ["😫", "😕", "😐", "🙂", "😊"]

    var body: some View {
        VStack(spacing: 16) {
            Text("How do you feel?")
                .font(.headline)

            HStack(spacing: 8) {
                ForEach(1...5, id: \.self) { score in
                    Button {
                        selectedScore = score
                    } label: {
                        Text(emojis[score - 1])
                            .font(.system(size: 28))
                            .opacity(selectedScore == score ? 1.0 : 0.4)
                            .scaleEffect(selectedScore == score ? 1.2 : 1.0)
                    }
                    .buttonStyle(.plain)
                }
            }

            Button {
                viewModel.confirmStop(withComfort: selectedScore * 2)
            } label: {
                Text("Done")
                    .font(.headline)
                    .foregroundStyle(.white)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 10)
                    .background(Color.blue)
                    .clipShape(RoundedRectangle(cornerRadius: 10))
            }
            .buttonStyle(.plain)
        }
        .padding()
    }
}

#Preview {
    WatchHomeView(viewModel: WatchViewModel())
}
