import Foundation
import SwiftData
import Combine

/// Manages wear session state and operations
@MainActor
final class WearSessionViewModel: ObservableObject {
    @Published private(set) var activeSession: WearSession?
    @Published private(set) var isWearing = false
    @Published private(set) var todaySessions: [WearSession] = []
    @Published private(set) var todayTotalSeconds: Int = 0
    @Published var showComfortPrompt = false
    @Published var errorMessage: String?

    private let modelContext: ModelContext
    private let healthKitService: HealthKitService
    private let watchConnectivityService: WatchConnectivityService
    private let notificationService: NotificationService
    private var cancellables = Set<AnyCancellable>()

    init(
        modelContext: ModelContext,
        healthKitService: HealthKitService,
        watchConnectivityService: WatchConnectivityService,
        notificationService: NotificationService
    ) {
        self.modelContext = modelContext
        self.healthKitService = healthKitService
        self.watchConnectivityService = watchConnectivityService
        self.notificationService = notificationService

        setupWatchMessageHandler()
    }

    /// Load current state from database
    func loadState() {
        fetchActiveSession()
        fetchTodaySessions()
        calculateTodayTotal()
    }

    /// Start a new wear session
    func startWearing(source: SessionSource = .iPhone) {
        guard activeSession == nil else { return }

        let session = WearSession(
            date: Date(),
            startTime: Date(),
            source: source,
            isActive: true
        )

        modelContext.insert(session)
        saveContext()

        activeSession = session
        isWearing = true

        watchConnectivityService.sendStartSession(sessionId: session.id, startTime: session.startTime)

        Task {
            try? await notificationService.scheduleLongWearAlert(afterHours: AppDefaults.longWearAlertHours)
        }
    }

    /// Stop the current wear session
    func stopWearing(comfortScore: Int? = nil, notes: String? = nil) {
        guard let session = activeSession else { return }

        session.endSession(comfortScore: comfortScore, notes: notes)
        saveContext()

        watchConnectivityService.sendStopSession(
            sessionId: session.id,
            endTime: session.endTime ?? Date(),
            comfortScore: comfortScore
        )

        notificationService.cancelLongWearAlert()

        if healthKitService.isAuthorized {
            Task {
                try? await healthKitService.saveWearSession(session)
            }
        }

        activeSession = nil
        isWearing = false

        fetchTodaySessions()
        calculateTodayTotal()

        if session.totalDurationSeconds > AppDefaults.autoPromptHealthLogAfterHours * 3600 {
            showComfortPrompt = true
        }
    }

    /// Toggle wear state
    func toggleWearing() {
        if isWearing {
            showComfortPrompt = true
        } else {
            startWearing()
        }
    }

    /// Get elapsed time for active session
    var elapsedTime: TimeInterval {
        activeSession?.elapsedTime ?? 0
    }

    /// Get formatted elapsed time
    var formattedElapsedTime: String {
        Formatters.formatTimer(interval: elapsedTime)
    }

    /// Get formatted today's total
    var formattedTodayTotal: String {
        let totalWithActive = todayTotalSeconds + Int(elapsedTime)
        return Formatters.formatDuration(seconds: totalWithActive)
    }

    // MARK: - Private Methods

    private func fetchActiveSession() {
        let descriptor = FetchDescriptor<WearSession>(
            predicate: #Predicate { $0.isActive },
            sortBy: [SortDescriptor(\.startTime, order: .reverse)]
        )

        do {
            let sessions = try modelContext.fetch(descriptor)
            activeSession = sessions.first
            isWearing = activeSession != nil
        } catch {
            errorMessage = "Failed to load active session"
        }
    }

    private func fetchTodaySessions() {
        let startOfDay = Date().startOfDay
        let endOfDay = Date().endOfDay

        let descriptor = FetchDescriptor<WearSession>(
            predicate: #Predicate { session in
                session.date >= startOfDay && session.date <= endOfDay && !session.isActive
            },
            sortBy: [SortDescriptor(\.startTime, order: .reverse)]
        )

        do {
            todaySessions = try modelContext.fetch(descriptor)
        } catch {
            errorMessage = "Failed to load today's sessions"
        }
    }

    private func calculateTodayTotal() {
        todayTotalSeconds = todaySessions.reduce(0) { $0 + $1.totalDurationSeconds }
    }

    private func saveContext() {
        do {
            try modelContext.save()
        } catch {
            errorMessage = "Failed to save session"
        }
    }

    private func setupWatchMessageHandler() {
        watchConnectivityService.messagePublisher
            .receive(on: DispatchQueue.main)
            .sink { [weak self] payload in
                self?.handleWatchMessage(payload)
            }
            .store(in: &cancellables)
    }

    private func handleWatchMessage(_ payload: WatchMessagePayload) {
        switch payload.type {
        case .startSession:
            if !isWearing {
                startWearing(source: .watch)
            }
        case .stopSession:
            if isWearing {
                stopWearing(comfortScore: payload.comfortScore)
            }
        case .syncRequest:
            syncWithWatch()
        case .sessionUpdate, .comfortLog:
            loadState()
        }
    }

    private func syncWithWatch() {
        guard let session = activeSession else { return }

        let payload = WatchMessagePayload(
            type: .sessionUpdate,
            sessionId: session.id,
            startTime: session.startTime
        )
        watchConnectivityService.sendMessage(payload)
    }
}
