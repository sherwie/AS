import SwiftUI

extension View {
    /// Apply standard card styling
    func cardStyle() -> some View {
        self
            .padding(DesignTokens.spacingMedium)
            .background(DesignTokens.surfaceSecondary)
            .clipShape(RoundedRectangle(cornerRadius: DesignTokens.cornerRadiusMedium))
    }

    /// Apply primary button styling
    func primaryButtonStyle() -> some View {
        self
            .font(DesignTokens.headlineFont)
            .foregroundStyle(.white)
            .frame(maxWidth: .infinity)
            .padding()
            .background(DesignTokens.primaryAction)
            .clipShape(RoundedRectangle(cornerRadius: DesignTokens.cornerRadiusMedium))
    }

    /// Apply secondary button styling
    func secondaryButtonStyle() -> some View {
        self
            .font(DesignTokens.headlineFont)
            .foregroundStyle(DesignTokens.primaryAction)
            .frame(maxWidth: .infinity)
            .padding()
            .background(DesignTokens.primaryAction.opacity(0.1))
            .clipShape(RoundedRectangle(cornerRadius: DesignTokens.cornerRadiusMedium))
    }

    /// Conditionally apply a modifier
    @ViewBuilder
    func `if`<Content: View>(_ condition: Bool, transform: (Self) -> Content) -> some View {
        if condition {
            transform(self)
        } else {
            self
        }
    }

    /// Add loading overlay
    func loading(_ isLoading: Bool) -> some View {
        self.overlay {
            if isLoading {
                ZStack {
                    Color.black.opacity(0.3)
                    ProgressView()
                        .tint(.white)
                        .scaleEffect(1.5)
                }
                .ignoresSafeArea()
            }
        }
    }

    /// Hide keyboard on tap
    func hideKeyboardOnTap() -> some View {
        self.onTapGesture {
            UIApplication.shared.sendAction(#selector(UIResponder.resignFirstResponder), to: nil, from: nil, for: nil)
        }
    }
}

// MARK: - Accessibility Extensions

extension View {
    /// Add standard accessibility traits for buttons
    func accessibleButton(label: String, hint: String? = nil) -> some View {
        self
            .accessibilityLabel(label)
            .accessibilityHint(hint ?? "")
            .accessibilityAddTraits(.isButton)
    }

    /// Add standard accessibility for headers
    func accessibleHeader() -> some View {
        self.accessibilityAddTraits(.isHeader)
    }
}
