import Foundation
import WatchConnectivity
import Combine

/// Watch message types matching iPhone app
enum WatchMessageType: String, Codable {
    case startSession = "START_SESSION"
    case stopSession = "STOP_SESSION"
    case syncRequest = "SYNC_REQUEST"
    case sessionUpdate = "SESSION_UPDATE"
    case comfortLog = "COMFORT_LOG"
}

/// Main view model for Watch app
@MainActor
final class WatchViewModel: NSObject, ObservableObject {
    @Published var isWearing = false
    @Published var sessionStartTime: Date?
    @Published var sessionId: UUID?
    @Published var comfortScore: Int = 5
    @Published var isConnected = false
    @Published var showingComfortPrompt = false
    @Published var errorMessage: String?

    private var session: WCSession?

    override init() {
        super.init()
        setupWatchConnectivity()
        loadLocalState()
    }

    /// Elapsed time for active session
    var elapsedTime: TimeInterval {
        guard let start = sessionStartTime else { return 0 }
        return Date().timeIntervalSince(start)
    }

    /// Formatted elapsed time string
    var formattedElapsedTime: String {
        let totalSeconds = Int(elapsedTime)
        let hours = totalSeconds / 3600
        let minutes = (totalSeconds % 3600) / 60
        let seconds = totalSeconds % 60

        if hours > 0 {
            return String(format: "%d:%02d:%02d", hours, minutes, seconds)
        } else {
            return String(format: "%02d:%02d", minutes, seconds)
        }
    }

    /// Start wearing lenses
    func startWearing() {
        let newSessionId = UUID()
        let startTime = Date()

        sessionId = newSessionId
        sessionStartTime = startTime
        isWearing = true

        saveLocalState()
        sendMessage(type: .startSession, sessionId: newSessionId, startTime: startTime)
    }

    /// Stop wearing lenses
    func stopWearing() {
        showingComfortPrompt = true
    }

    /// Confirm stop with comfort score
    func confirmStop(withComfort score: Int) {
        guard let id = sessionId else { return }

        comfortScore = score
        let endTime = Date()

        sendMessage(
            type: .stopSession,
            sessionId: id,
            endTime: endTime,
            comfortScore: score
        )

        isWearing = false
        sessionStartTime = nil
        sessionId = nil
        showingComfortPrompt = false

        saveLocalState()
    }

    /// Toggle wear state
    func toggleWearing() {
        if isWearing {
            stopWearing()
        } else {
            startWearing()
        }
    }

    /// Request sync from iPhone
    func requestSync() {
        sendMessage(type: .syncRequest)
    }

    // MARK: - Private Methods

    private func setupWatchConnectivity() {
        guard WCSession.isSupported() else {
            errorMessage = "Watch connectivity not supported"
            return
        }

        session = WCSession.default
        session?.delegate = self
        session?.activate()
    }

    private func sendMessage(
        type: WatchMessageType,
        sessionId: UUID? = nil,
        startTime: Date? = nil,
        endTime: Date? = nil,
        comfortScore: Int? = nil
    ) {
        guard let session = session, session.activationState == .activated else {
            return
        }

        var message: [String: Any] = [
            "type": type.rawValue,
            "timestamp": Date().timeIntervalSince1970
        ]

        if let sessionId = sessionId {
            message["sessionId"] = sessionId.uuidString
        }
        if let startTime = startTime {
            message["startTime"] = startTime.timeIntervalSince1970
        }
        if let endTime = endTime {
            message["endTime"] = endTime.timeIntervalSince1970
        }
        if let comfortScore = comfortScore {
            message["comfortScore"] = comfortScore
        }

        if session.isReachable {
            session.sendMessage(message, replyHandler: nil) { [weak self] error in
                Task { @MainActor in
                    self?.errorMessage = "Failed to send: \(error.localizedDescription)"
                }
            }
        } else {
            do {
                try session.updateApplicationContext(message)
            } catch {
                errorMessage = "Failed to update context"
            }
        }
    }

    private func handleReceivedMessage(_ message: [String: Any]) {
        guard let typeString = message["type"] as? String,
              let type = WatchMessageType(rawValue: typeString)
        else { return }

        switch type {
        case .startSession:
            if let sessionIdString = message["sessionId"] as? String,
               let id = UUID(uuidString: sessionIdString),
               let startTimeValue = message["startTime"] as? TimeInterval {
                sessionId = id
                sessionStartTime = Date(timeIntervalSince1970: startTimeValue)
                isWearing = true
                saveLocalState()
            }

        case .stopSession:
            isWearing = false
            sessionStartTime = nil
            sessionId = nil
            saveLocalState()

        case .sessionUpdate:
            if let startTimeValue = message["startTime"] as? TimeInterval {
                sessionStartTime = Date(timeIntervalSince1970: startTimeValue)
                isWearing = true
                saveLocalState()
            }

        case .syncRequest, .comfortLog:
            break
        }
    }

    // MARK: - Local State Persistence

    private let isWearingKey = "isWearing"
    private let sessionStartTimeKey = "sessionStartTime"
    private let sessionIdKey = "sessionId"

    private func saveLocalState() {
        let defaults = UserDefaults.standard
        defaults.set(isWearing, forKey: isWearingKey)

        if let startTime = sessionStartTime {
            defaults.set(startTime.timeIntervalSince1970, forKey: sessionStartTimeKey)
        } else {
            defaults.removeObject(forKey: sessionStartTimeKey)
        }

        if let id = sessionId {
            defaults.set(id.uuidString, forKey: sessionIdKey)
        } else {
            defaults.removeObject(forKey: sessionIdKey)
        }
    }

    private func loadLocalState() {
        let defaults = UserDefaults.standard
        isWearing = defaults.bool(forKey: isWearingKey)

        if let startTimeValue = defaults.object(forKey: sessionStartTimeKey) as? TimeInterval {
            sessionStartTime = Date(timeIntervalSince1970: startTimeValue)
        }

        if let idString = defaults.string(forKey: sessionIdKey) {
            sessionId = UUID(uuidString: idString)
        }
    }
}

// MARK: - WCSessionDelegate

extension WatchViewModel: WCSessionDelegate {
    nonisolated func session(_ session: WCSession, activationDidCompleteWith activationState: WCSessionActivationState, error: Error?) {
        Task { @MainActor in
            if let error = error {
                errorMessage = error.localizedDescription
            }
            isConnected = activationState == .activated
        }
    }

    nonisolated func sessionReachabilityDidChange(_ session: WCSession) {
        Task { @MainActor in
            isConnected = session.isReachable
        }
    }

    nonisolated func session(_ session: WCSession, didReceiveMessage message: [String: Any]) {
        Task { @MainActor in
            handleReceivedMessage(message)
        }
    }

    nonisolated func session(_ session: WCSession, didReceiveMessage message: [String: Any], replyHandler: @escaping ([String: Any]) -> Void) {
        Task { @MainActor in
            handleReceivedMessage(message)
        }
        replyHandler(["received": true])
    }

    nonisolated func session(_ session: WCSession, didReceiveApplicationContext applicationContext: [String: Any]) {
        Task { @MainActor in
            handleReceivedMessage(applicationContext)
        }
    }
}
