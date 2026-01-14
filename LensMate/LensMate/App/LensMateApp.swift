import SwiftUI
import SwiftData

@main
struct LensMateApp: App {
    @StateObject private var appContainer = AppContainer()

    var body: some Scene {
        WindowGroup {
            ContentView()
                .environmentObject(appContainer)
                .modelContainer(appContainer.modelContainer)
        }
    }
}

/// Dependency injection container for the app
@MainActor
final class AppContainer: ObservableObject {
    let modelContainer: ModelContainer
    let healthKitService: HealthKitService
    let watchConnectivityService: WatchConnectivityService
    let notificationService: NotificationService
    let pdfReportService: PDFReportService

    init() {
        let schema = Schema([
            WearSession.self,
            HealthEntry.self,
            LensProfile.self,
            Inventory.self,
            DoctorProfile.self,
            AppSettings.self
        ])

        let modelConfiguration = ModelConfiguration(
            schema: schema,
            isStoredInMemoryOnly: false,
            cloudKitDatabase: .private(CloudKitConfig.containerIdentifier)
        )

        do {
            self.modelContainer = try ModelContainer(for: schema, configurations: [modelConfiguration])
        } catch {
            fatalError("Failed to create ModelContainer: \(error)")
        }

        self.healthKitService = HealthKitService()
        self.watchConnectivityService = WatchConnectivityService.shared
        self.notificationService = NotificationService()
        self.pdfReportService = PDFReportService()

        watchConnectivityService.activate()
    }
}
