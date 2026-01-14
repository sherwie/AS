import Foundation
import SwiftData

/// Tracks contact lens inventory levels
@Model
final class Inventory {
    @Attribute(.unique) var id: UUID
    var unitsRemaining: Int
    var lowStockThreshold: Int
    var lastUpdated: Date

    init(
        id: UUID = UUID(),
        unitsRemaining: Int = 0,
        lowStockThreshold: Int = 7,
        lastUpdated: Date = Date()
    ) {
        self.id = id
        self.unitsRemaining = unitsRemaining
        self.lowStockThreshold = lowStockThreshold
        self.lastUpdated = lastUpdated
    }

    /// Whether stock is below threshold
    var isLowStock: Bool {
        unitsRemaining <= lowStockThreshold
    }

    /// Stock level as a percentage (capped at 100%)
    var stockPercentage: Double {
        guard lowStockThreshold > 0 else { return 0 }
        let maxStock = lowStockThreshold * 4
        return min(1.0, Double(unitsRemaining) / Double(maxStock))
    }

    /// Stock status for display
    var stockStatus: StockStatus {
        if unitsRemaining == 0 {
            return .empty
        } else if isLowStock {
            return .low
        } else {
            return .adequate
        }
    }

    /// Add units to inventory
    func addUnits(_ count: Int) {
        unitsRemaining += count
        lastUpdated = Date()
    }

    /// Remove units from inventory
    func removeUnits(_ count: Int) {
        unitsRemaining = max(0, unitsRemaining - count)
        lastUpdated = Date()
    }

    /// Use one pair of lenses
    func usePair() {
        removeUnits(1)
    }
}

enum StockStatus: String, CaseIterable {
    case empty = "Out of Stock"
    case low = "Low Stock"
    case adequate = "In Stock"

    var iconName: String {
        switch self {
        case .empty: return "exclamationmark.triangle.fill"
        case .low: return "exclamationmark.circle.fill"
        case .adequate: return "checkmark.circle.fill"
        }
    }

    var colorName: String {
        switch self {
        case .empty: return "red"
        case .low: return "orange"
        case .adequate: return "green"
        }
    }
}
