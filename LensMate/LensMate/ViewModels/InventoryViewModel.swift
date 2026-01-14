import Foundation
import SwiftData
import Combine

/// Manages inventory tracking and lens profile
@MainActor
final class InventoryViewModel: ObservableObject {
    @Published var inventory: Inventory?
    @Published var lensProfile: LensProfile?
    @Published var errorMessage: String?

    @Published var unitsToAdd: Int = 1
    @Published var showingAddStock = false

    private let modelContext: ModelContext
    private let notificationService: NotificationService

    init(modelContext: ModelContext, notificationService: NotificationService) {
        self.modelContext = modelContext
        self.notificationService = notificationService
    }

    /// Load inventory and lens profile data
    func loadData() {
        fetchInventory()
        fetchLensProfile()
    }

    /// Add stock to inventory
    func addStock(_ count: Int) {
        guard count > 0 else { return }

        if let inventory = inventory {
            inventory.addUnits(count)
        } else {
            let newInventory = Inventory(unitsRemaining: count)
            modelContext.insert(newInventory)
            inventory = newInventory
        }

        saveContext()
        showingAddStock = false
    }

    /// Quick adjust inventory
    func adjustInventory(by amount: Int) {
        guard let inventory = inventory else {
            if amount > 0 {
                addStock(amount)
            }
            return
        }

        if amount > 0 {
            inventory.addUnits(amount)
        } else {
            inventory.removeUnits(abs(amount))
        }

        saveContext()
        checkLowStockNotification()
    }

    /// Update low stock threshold
    func updateThreshold(_ threshold: Int) {
        guard let inventory = inventory, threshold > 0 else { return }
        inventory.lowStockThreshold = threshold
        saveContext()
    }

    /// Mark lenses as replaced (uses one pair from inventory)
    func markLensesReplaced() {
        lensProfile?.replaceLenses()
        inventory?.usePair()
        saveContext()
        checkLowStockNotification()
    }

    /// Create or update lens profile
    func saveLensProfile(
        type: LensType,
        brandName: String?,
        customCycleDays: Int?
    ) {
        if let profile = lensProfile {
            profile.lensType = type
            profile.brandName = brandName
            profile.replacementCycleDays = customCycleDays ?? type.defaultCycleDays
        } else {
            let profile = LensProfile(
                lensType: type,
                brandName: brandName,
                replacementCycleDays: customCycleDays,
                currentPairStartDate: Date(),
                isActive: true
            )
            modelContext.insert(profile)
            lensProfile = profile
        }

        saveContext()
    }

    /// Stock status for display
    var stockStatus: StockStatus {
        inventory?.stockStatus ?? .empty
    }

    /// Stock percentage for progress indicator
    var stockPercentage: Double {
        inventory?.stockPercentage ?? 0
    }

    /// Days until replacement
    var daysUntilReplacement: Int? {
        lensProfile?.daysUntilReplacement
    }

    /// Days current pair has been used
    var daysUsed: Int {
        lensProfile?.daysUsed ?? 0
    }

    /// Whether lenses are overdue
    var isOverdue: Bool {
        lensProfile?.isOverdue ?? false
    }

    /// Formatted replacement date
    var formattedReplacementDate: String? {
        guard let date = lensProfile?.nextReplacementDate else { return nil }
        return Formatters.shortDate.string(from: date)
    }

    // MARK: - Private Methods

    private func fetchInventory() {
        let descriptor = FetchDescriptor<Inventory>()

        do {
            let inventories = try modelContext.fetch(descriptor)
            inventory = inventories.first
        } catch {
            errorMessage = "Failed to load inventory"
        }
    }

    private func fetchLensProfile() {
        let descriptor = FetchDescriptor<LensProfile>(
            predicate: #Predicate { $0.isActive }
        )

        do {
            let profiles = try modelContext.fetch(descriptor)
            lensProfile = profiles.first
        } catch {
            errorMessage = "Failed to load lens profile"
        }
    }

    private func checkLowStockNotification() {
        guard let inventory = inventory, inventory.isLowStock else { return }

        Task {
            try? await notificationService.scheduleLowInventoryAlert(
                unitsRemaining: inventory.unitsRemaining
            )
        }
    }

    private func saveContext() {
        do {
            try modelContext.save()
        } catch {
            errorMessage = "Failed to save changes"
        }
    }
}
