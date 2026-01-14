import Foundation
import HealthKit
import Combine

/// Manages HealthKit integration for wear session tracking
@MainActor
final class HealthKitService: ObservableObject {
    private let healthStore = HKHealthStore()

    @Published private(set) var isAuthorized = false
    @Published private(set) var isAvailable = false
    @Published private(set) var authorizationError: HealthKitError?

    private let typesToWrite: Set<HKSampleType> = [
        HKWorkoutType.workoutType()
    ]

    private let typesToRead: Set<HKObjectType> = [
        HKWorkoutType.workoutType()
    ]

    init() {
        isAvailable = HKHealthStore.isHealthDataAvailable()
    }

    /// Request HealthKit authorization
    func requestAuthorization() async throws {
        guard isAvailable else {
            throw HealthKitError.notAvailable
        }

        do {
            try await healthStore.requestAuthorization(toShare: typesToWrite, read: typesToRead)
            await checkAuthorizationStatus()
        } catch {
            authorizationError = .authorizationFailed(error)
            throw HealthKitError.authorizationFailed(error)
        }
    }

    /// Check current authorization status
    func checkAuthorizationStatus() async {
        let workoutType = HKWorkoutType.workoutType()
        let status = healthStore.authorizationStatus(for: workoutType)
        isAuthorized = status == .sharingAuthorized
    }

    /// Save a wear session as a workout to HealthKit
    func saveWearSession(_ session: WearSession) async throws {
        guard isAuthorized else {
            throw HealthKitError.notAuthorized
        }

        guard let endTime = session.endTime else {
            throw HealthKitError.invalidSession
        }

        let workout = HKWorkout(
            activityType: .other,
            start: session.startTime,
            end: endTime,
            duration: session.elapsedTime,
            totalEnergyBurned: nil,
            totalDistance: nil,
            metadata: [
                HKMetadataKeyWorkoutBrandName: "LensMate",
                "LensWearSession": true,
                "ComfortScore": session.comfortScore ?? 0
            ]
        )

        do {
            try await healthStore.save(workout)
        } catch {
            throw HealthKitError.saveFailed(error)
        }
    }

    /// Fetch wear sessions from HealthKit within a date range
    func fetchWearSessions(from startDate: Date, to endDate: Date) async throws -> [HKWorkout] {
        guard isAuthorized else {
            throw HealthKitError.notAuthorized
        }

        let predicate = HKQuery.predicateForSamples(
            withStart: startDate,
            end: endDate,
            options: .strictStartDate
        )

        let brandPredicate = HKQuery.predicateForObjects(
            withMetadataKey: HKMetadataKeyWorkoutBrandName,
            allowedValues: ["LensMate"]
        )

        let compoundPredicate = NSCompoundPredicate(
            andPredicateWithSubpredicates: [predicate, brandPredicate]
        )

        let sortDescriptor = NSSortDescriptor(
            key: HKSampleSortIdentifierStartDate,
            ascending: false
        )

        return try await withCheckedThrowingContinuation { continuation in
            let query = HKSampleQuery(
                sampleType: HKWorkoutType.workoutType(),
                predicate: compoundPredicate,
                limit: HKObjectQueryNoLimit,
                sortDescriptors: [sortDescriptor]
            ) { _, samples, error in
                if let error = error {
                    continuation.resume(throwing: HealthKitError.fetchFailed(error))
                    return
                }

                let workouts = samples as? [HKWorkout] ?? []
                continuation.resume(returning: workouts)
            }

            healthStore.execute(query)
        }
    }

    /// Calculate total wear time within a date range
    func totalWearTime(from startDate: Date, to endDate: Date) async throws -> TimeInterval {
        let sessions = try await fetchWearSessions(from: startDate, to: endDate)
        return sessions.reduce(0) { $0 + $1.duration }
    }
}

enum HealthKitError: LocalizedError {
    case notAvailable
    case notAuthorized
    case authorizationFailed(Error)
    case invalidSession
    case saveFailed(Error)
    case fetchFailed(Error)

    var errorDescription: String? {
        switch self {
        case .notAvailable:
            return "Health features aren't available on this device."
        case .notAuthorized:
            return "Please enable Health access in Settings to use this feature."
        case .authorizationFailed(let error):
            return "Failed to authorize Health access: \(error.localizedDescription)"
        case .invalidSession:
            return "Cannot save an incomplete wear session."
        case .saveFailed(let error):
            return "Failed to save session to Health: \(error.localizedDescription)"
        case .fetchFailed(let error):
            return "Failed to fetch health data: \(error.localizedDescription)"
        }
    }
}
