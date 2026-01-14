import Foundation
import WatchConnectivity
import Combine

/// Message types for Watch-iPhone communication
enum WatchMessage: String, Codable {
    case startSession = "START_SESSION"
    case stopSession = "STOP_SESSION"
    case syncRequest = "SYNC_REQUEST"
    case sessionUpdate = "SESSION_UPDATE"
    case comfortLog = "COMFORT_LOG"
}

/// Payload structure for watch messages
struct WatchMessagePayload: Codable {
    let type: WatchMessage
    let sessionId: UUID?
    let startTime: Date?
    let endTime: Date?
    let comfortScore: Int?
    let timestamp: Date

    init(
        type: WatchMessage,
        sessionId: UUID? = nil,
        startTime: Date? = nil,
        endTime: Date? = nil,
        comfortScore: Int? = nil
    ) {
        self.type = type
        self.sessionId = sessionId
        self.startTime = startTime
        self.endTime = endTime
        self.comfortScore = comfortScore
        self.timestamp = Date()
    }

    var dictionary: [String: Any] {
        var dict: [String: Any] = [
            "type": type.rawValue,
            "timestamp": timestamp.timeIntervalSince1970
        ]
        if let sessionId = sessionId {
            dict["sessionId"] = sessionId.uuidString
        }
        if let startTime = startTime {
            dict["startTime"] = startTime.timeIntervalSince1970
        }
        if let endTime = endTime {
            dict["endTime"] = endTime.timeIntervalSince1970
        }
        if let comfortScore = comfortScore {
            dict["comfortScore"] = comfortScore
        }
        return dict
    }

    init?(from dictionary: [String: Any]) {
        guard let typeString = dictionary["type"] as? String,
              let type = WatchMessage(rawValue: typeString),
              let timestampValue = dictionary["timestamp"] as? TimeInterval
        else { return nil }

        self.type = type
        self.timestamp = Date(timeIntervalSince1970: timestampValue)

        if let sessionIdString = dictionary["sessionId"] as? String {
            self.sessionId = UUID(uuidString: sessionIdString)
        } else {
            self.sessionId = nil
        }

        if let startTimeValue = dictionary["startTime"] as? TimeInterval {
            self.startTime = Date(timeIntervalSince1970: startTimeValue)
        } else {
            self.startTime = nil
        }

        if let endTimeValue = dictionary["endTime"] as? TimeInterval {
            self.endTime = Date(timeIntervalSince1970: endTimeValue)
        } else {
            self.endTime = nil
        }

        self.comfortScore = dictionary["comfortScore"] as? Int
    }
}

/// Manages bidirectional communication between iPhone and Apple Watch
@MainActor
final class WatchConnectivityService: NSObject, ObservableObject {
    static let shared = WatchConnectivityService()

    @Published private(set) var isReachable = false
    @Published private(set) var isPaired = false
    @Published private(set) var isWatchAppInstalled = false
    @Published private(set) var lastReceivedMessage: WatchMessagePayload?
    @Published private(set) var connectionError: WatchConnectivityError?

    private let session: WCSession?
    private var pendingMessages: [WatchMessagePayload] = []

    private let messageSubject = PassthroughSubject<WatchMessagePayload, Never>()
    var messagePublisher: AnyPublisher<WatchMessagePayload, Never> {
        messageSubject.eraseToAnyPublisher()
    }

    override init() {
        if WCSession.isSupported() {
            session = WCSession.default
        } else {
            session = nil
        }
        super.init()
    }

    /// Activate the WatchConnectivity session
    func activate() {
        guard let session = session else {
            connectionError = .notSupported
            return
        }

        session.delegate = self
        session.activate()
    }

    /// Send a message to the paired device
    func sendMessage(_ payload: WatchMessagePayload, completion: ((Result<Void, WatchConnectivityError>) -> Void)? = nil) {
        guard let session = session else {
            completion?(.failure(.notSupported))
            return
        }

        guard session.activationState == .activated else {
            pendingMessages.append(payload)
            completion?(.failure(.notActivated))
            return
        }

        #if os(iOS)
        guard session.isWatchAppInstalled else {
            completion?(.failure(.watchAppNotInstalled))
            return
        }
        #endif

        if session.isReachable {
            session.sendMessage(payload.dictionary, replyHandler: { _ in
                completion?(.success(()))
            }, errorHandler: { error in
                completion?(.failure(.sendFailed(error)))
            })
        } else {
            do {
                try session.updateApplicationContext(payload.dictionary)
                completion?(.success(()))
            } catch {
                pendingMessages.append(payload)
                completion?(.failure(.sendFailed(error)))
            }
        }
    }

    /// Send a start session message
    func sendStartSession(sessionId: UUID, startTime: Date) {
        let payload = WatchMessagePayload(
            type: .startSession,
            sessionId: sessionId,
            startTime: startTime
        )
        sendMessage(payload)
    }

    /// Send a stop session message
    func sendStopSession(sessionId: UUID, endTime: Date, comfortScore: Int?) {
        let payload = WatchMessagePayload(
            type: .stopSession,
            sessionId: sessionId,
            endTime: endTime,
            comfortScore: comfortScore
        )
        sendMessage(payload)
    }

    /// Request a full sync
    func requestSync() {
        let payload = WatchMessagePayload(type: .syncRequest)
        sendMessage(payload)
    }

    /// Process pending messages after connection is established
    private func processPendingMessages() {
        let messages = pendingMessages
        pendingMessages.removeAll()

        for message in messages {
            sendMessage(message)
        }
    }

    /// Update connection status properties
    private func updateConnectionStatus() {
        guard let session = session else { return }

        Task { @MainActor in
            isReachable = session.isReachable

            #if os(iOS)
            isPaired = session.isPaired
            isWatchAppInstalled = session.isWatchAppInstalled
            #endif
        }
    }
}

extension WatchConnectivityService: WCSessionDelegate {
    nonisolated func session(_ session: WCSession, activationDidCompleteWith activationState: WCSessionActivationState, error: Error?) {
        Task { @MainActor in
            if let error = error {
                connectionError = .activationFailed(error)
            } else if activationState == .activated {
                updateConnectionStatus()
                processPendingMessages()
            }
        }
    }

    #if os(iOS)
    nonisolated func sessionDidBecomeInactive(_ session: WCSession) {
        Task { @MainActor in
            isReachable = false
        }
    }

    nonisolated func sessionDidDeactivate(_ session: WCSession) {
        Task { @MainActor in
            isReachable = false
            session.activate()
        }
    }

    nonisolated func sessionWatchStateDidChange(_ session: WCSession) {
        Task { @MainActor in
            updateConnectionStatus()
        }
    }
    #endif

    nonisolated func sessionReachabilityDidChange(_ session: WCSession) {
        Task { @MainActor in
            isReachable = session.isReachable
            if session.isReachable {
                processPendingMessages()
            }
        }
    }

    nonisolated func session(_ session: WCSession, didReceiveMessage message: [String: Any]) {
        Task { @MainActor in
            if let payload = WatchMessagePayload(from: message) {
                lastReceivedMessage = payload
                messageSubject.send(payload)
            }
        }
    }

    nonisolated func session(_ session: WCSession, didReceiveMessage message: [String: Any], replyHandler: @escaping ([String: Any]) -> Void) {
        Task { @MainActor in
            if let payload = WatchMessagePayload(from: message) {
                lastReceivedMessage = payload
                messageSubject.send(payload)
            }
            replyHandler(["received": true])
        }
    }

    nonisolated func session(_ session: WCSession, didReceiveApplicationContext applicationContext: [String: Any]) {
        Task { @MainActor in
            if let payload = WatchMessagePayload(from: applicationContext) {
                lastReceivedMessage = payload
                messageSubject.send(payload)
            }
        }
    }
}

enum WatchConnectivityError: LocalizedError {
    case notSupported
    case notActivated
    case watchAppNotInstalled
    case notReachable
    case sendFailed(Error)
    case activationFailed(Error)

    var errorDescription: String? {
        switch self {
        case .notSupported:
            return "Watch connectivity is not supported on this device."
        case .notActivated:
            return "Watch session is not yet activated."
        case .watchAppNotInstalled:
            return "The LensMate watch app is not installed."
        case .notReachable:
            return "Apple Watch is not reachable."
        case .sendFailed(let error):
            return "Failed to send message: \(error.localizedDescription)"
        case .activationFailed(let error):
            return "Failed to activate watch session: \(error.localizedDescription)"
        }
    }
}
