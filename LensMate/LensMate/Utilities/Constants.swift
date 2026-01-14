import Foundation
import SwiftUI

/// Design tokens for consistent styling throughout the app
enum DesignTokens {
    // MARK: - Semantic Colors

    static let primaryAction = Color.blue
    static let success = Color.green
    static let warning = Color.orange
    static let danger = Color.red
    static let surface = Color(.systemBackground)
    static let surfaceSecondary = Color(.secondarySystemBackground)
    static let surfaceTertiary = Color(.tertiarySystemBackground)

    // MARK: - Typography

    static let titleFont = Font.system(.title, design: .rounded, weight: .semibold)
    static let title2Font = Font.system(.title2, design: .rounded, weight: .semibold)
    static let title3Font = Font.system(.title3, design: .rounded, weight: .medium)
    static let headlineFont = Font.system(.headline, design: .default, weight: .semibold)
    static let bodyFont = Font.system(.body, design: .default)
    static let calloutFont = Font.system(.callout, design: .default)
    static let captionFont = Font.system(.caption, design: .default)
    static let caption2Font = Font.system(.caption2, design: .default)

    // MARK: - Spacing

    static let spacingXSmall: CGFloat = 4
    static let spacingSmall: CGFloat = 8
    static let spacingMedium: CGFloat = 16
    static let spacingLarge: CGFloat = 24
    static let spacingXLarge: CGFloat = 32

    // MARK: - Corner Radius

    static let cornerRadiusSmall: CGFloat = 8
    static let cornerRadiusMedium: CGFloat = 12
    static let cornerRadiusLarge: CGFloat = 20
    static let cornerRadiusFull: CGFloat = 999

    // MARK: - Sizes

    static let minTouchTarget: CGFloat = 44
    static let iconSizeSmall: CGFloat = 16
    static let iconSizeMedium: CGFloat = 24
    static let iconSizeLarge: CGFloat = 32

    // MARK: - Animation

    static let animationDuration: Double = 0.25
    static let animationSpring = Animation.spring(response: 0.3, dampingFraction: 0.7)
}

/// App-wide string constants
enum AppStrings {
    static let appName = "LensMate"
    static let tagline = "Your contact lens companion"

    enum Tabs {
        static let today = "Today"
        static let history = "History"
        static let inventory = "Inventory"
        static let settings = "Settings"
    }

    enum WearStatus {
        static let wearing = "Wearing"
        static let notWearing = "Not Wearing"
        static let startWear = "Start Wearing"
        static let stopWear = "Stop Wearing"
    }

    enum Accessibility {
        static let startWearButton = "Start wearing contact lenses"
        static let stopWearButton = "Stop wearing contact lenses"
        static let comfortSlider = "Rate your comfort level from 1 to 10"
        static let timerDisplay = "Elapsed wear time"
    }
}

/// Default values and limits
enum AppDefaults {
    static let maxWearHoursDefault = 12
    static let lowStockThresholdDefault = 7
    static let comfortScoreMin = 1
    static let comfortScoreMax = 10
    static let comfortScoreDefault = 5

    static let longWearAlertHours = 10
    static let autoPromptHealthLogAfterHours = 8
    static let autoPromptHealthLogAfterDays = 3
}

/// iCloud container identifier
enum CloudKitConfig {
    static let containerIdentifier = "iCloud.com.lensmate.app"
}
