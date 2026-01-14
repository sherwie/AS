import SwiftUI
import WatchConnectivity

@main
struct LensMateWatchApp: App {
    @StateObject private var watchViewModel = WatchViewModel()

    var body: some Scene {
        WindowGroup {
            WatchHomeView(viewModel: watchViewModel)
        }
    }
}
