import SwiftUI
import SwiftData

struct ContentView: View {
    @EnvironmentObject private var appContainer: AppContainer
    @Environment(\.modelContext) private var modelContext
    @State private var selectedTab = 0

    var body: some View {
        TabView(selection: $selectedTab) {
            HomeView(
                wearSessionViewModel: createWearSessionViewModel(),
                homeViewModel: createHomeViewModel()
            )
            .tabItem {
                Label(AppStrings.Tabs.today, systemImage: "sun.max.fill")
            }
            .tag(0)

            HistoryView(viewModel: createHistoryViewModel())
                .tabItem {
                    Label(AppStrings.Tabs.history, systemImage: "calendar")
                }
                .tag(1)

            InventoryView(viewModel: createInventoryViewModel())
                .tabItem {
                    Label(AppStrings.Tabs.inventory, systemImage: "shippingbox.fill")
                }
                .tag(2)

            SettingsView(viewModel: createSettingsViewModel())
                .tabItem {
                    Label(AppStrings.Tabs.settings, systemImage: "gearshape.fill")
                }
                .tag(3)
        }
    }

    private func createWearSessionViewModel() -> WearSessionViewModel {
        WearSessionViewModel(
            modelContext: modelContext,
            healthKitService: appContainer.healthKitService,
            watchConnectivityService: appContainer.watchConnectivityService,
            notificationService: appContainer.notificationService
        )
    }

    private func createHomeViewModel() -> HomeViewModel {
        HomeViewModel(modelContext: modelContext)
    }

    private func createHistoryViewModel() -> HistoryViewModel {
        HistoryViewModel(modelContext: modelContext)
    }

    private func createInventoryViewModel() -> InventoryViewModel {
        InventoryViewModel(
            modelContext: modelContext,
            notificationService: appContainer.notificationService
        )
    }

    private func createSettingsViewModel() -> SettingsViewModel {
        SettingsViewModel(
            modelContext: modelContext,
            healthKitService: appContainer.healthKitService,
            notificationService: appContainer.notificationService
        )
    }
}

#Preview {
    ContentView()
        .environmentObject(AppContainer())
}
