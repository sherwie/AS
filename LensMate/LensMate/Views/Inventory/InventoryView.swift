import SwiftUI

struct InventoryView: View {
    @StateObject var viewModel: InventoryViewModel
    @State private var showingLensProfile = false

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: DesignTokens.spacingLarge) {
                    StockLevelCard(viewModel: viewModel)

                    if let profile = viewModel.lensProfile {
                        LensInfoCard(
                            profile: profile,
                            daysUsed: viewModel.daysUsed,
                            isOverdue: viewModel.isOverdue,
                            onReplace: viewModel.markLensesReplaced
                        )
                    } else {
                        SetupLensProfileCard {
                            showingLensProfile = true
                        }
                    }

                    QuickActionsCard(viewModel: viewModel)
                }
                .padding(DesignTokens.spacingMedium)
            }
            .background(DesignTokens.surface)
            .navigationTitle(AppStrings.Tabs.inventory)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button {
                        showingLensProfile = true
                    } label: {
                        Image(systemName: "gearshape")
                    }
                }
            }
            .sheet(isPresented: $viewModel.showingAddStock) {
                AddStockSheet(viewModel: viewModel)
            }
            .sheet(isPresented: $showingLensProfile) {
                LensProfileSheet(viewModel: viewModel)
            }
            .onAppear {
                viewModel.loadData()
            }
        }
    }
}

/// Card showing current stock level
struct StockLevelCard: View {
    @ObservedObject var viewModel: InventoryViewModel

    private var stockColor: Color {
        switch viewModel.stockStatus {
        case .empty:
            return DesignTokens.danger
        case .low:
            return DesignTokens.warning
        case .adequate:
            return DesignTokens.success
        }
    }

    var body: some View {
        VStack(spacing: DesignTokens.spacingMedium) {
            HStack {
                VStack(alignment: .leading, spacing: DesignTokens.spacingXSmall) {
                    Text("Stock Level")
                        .font(DesignTokens.captionFont)
                        .foregroundStyle(.secondary)

                    Text("\(viewModel.inventory?.unitsRemaining ?? 0)")
                        .font(.system(size: 48, weight: .bold, design: .rounded))
                        .foregroundStyle(stockColor)

                    Text("pairs remaining")
                        .font(DesignTokens.bodyFont)
                        .foregroundStyle(.secondary)
                }

                Spacer()

                VStack {
                    Image(systemName: viewModel.stockStatus.iconName)
                        .font(.system(size: 40))
                        .foregroundStyle(stockColor)

                    Text(viewModel.stockStatus.rawValue)
                        .font(DesignTokens.captionFont)
                        .foregroundStyle(.secondary)
                }
            }

            ProgressView(value: viewModel.stockPercentage)
                .tint(stockColor)
        }
        .padding(DesignTokens.spacingLarge)
        .background(DesignTokens.surfaceSecondary)
        .clipShape(RoundedRectangle(cornerRadius: DesignTokens.cornerRadiusLarge))
    }
}

/// Card showing current lens info and replacement status
struct LensInfoCard: View {
    let profile: LensProfile
    let daysUsed: Int
    let isOverdue: Bool
    let onReplace: () -> Void

    var body: some View {
        VStack(spacing: DesignTokens.spacingMedium) {
            HStack {
                VStack(alignment: .leading, spacing: DesignTokens.spacingXSmall) {
                    Text(profile.lensType.displayName)
                        .font(DesignTokens.headlineFont)

                    if let brand = profile.brandName, !brand.isEmpty {
                        Text(brand)
                            .font(DesignTokens.bodyFont)
                            .foregroundStyle(.secondary)
                    }
                }

                Spacer()

                VStack(alignment: .trailing, spacing: DesignTokens.spacingXSmall) {
                    Text("Day \(daysUsed)")
                        .font(DesignTokens.title3Font)
                        .foregroundStyle(isOverdue ? DesignTokens.danger : .primary)

                    Text("of \(profile.replacementCycleDays)")
                        .font(DesignTokens.captionFont)
                        .foregroundStyle(.secondary)
                }
            }

            if let days = profile.daysUntilReplacement {
                HStack {
                    if isOverdue {
                        Label(
                            "\(abs(days)) days overdue",
                            systemImage: "exclamationmark.triangle.fill"
                        )
                        .foregroundStyle(DesignTokens.danger)
                    } else if days <= 2 {
                        Label(
                            "Replace \(Formatters.formatDaysRemaining(days))",
                            systemImage: "clock.fill"
                        )
                        .foregroundStyle(DesignTokens.warning)
                    } else {
                        Label(
                            "Replace \(Formatters.formatDaysRemaining(days))",
                            systemImage: "checkmark.circle.fill"
                        )
                        .foregroundStyle(DesignTokens.success)
                    }

                    Spacer()
                }
                .font(DesignTokens.captionFont)
            }

            Button(action: onReplace) {
                Label("Mark as Replaced", systemImage: "arrow.triangle.2.circlepath")
                    .font(DesignTokens.headlineFont)
                    .foregroundStyle(.white)
                    .frame(maxWidth: .infinity)
                    .padding()
                    .background(DesignTokens.primaryAction)
                    .clipShape(RoundedRectangle(cornerRadius: DesignTokens.cornerRadiusMedium))
            }
        }
        .padding(DesignTokens.spacingLarge)
        .background(DesignTokens.surfaceSecondary)
        .clipShape(RoundedRectangle(cornerRadius: DesignTokens.cornerRadiusLarge))
    }
}

/// Prompt to set up lens profile
struct SetupLensProfileCard: View {
    let onSetup: () -> Void

    var body: some View {
        VStack(spacing: DesignTokens.spacingMedium) {
            Image(systemName: "eye.circle")
                .font(.system(size: 40))
                .foregroundStyle(.secondary)

            Text("Set Up Your Lens Profile")
                .font(DesignTokens.headlineFont)

            Text("Configure your lens type to track replacement schedules.")
                .font(DesignTokens.bodyFont)
                .foregroundStyle(.secondary)
                .multilineTextAlignment(.center)

            Button("Set Up", action: onSetup)
                .buttonStyle(.borderedProminent)
        }
        .padding(DesignTokens.spacingLarge)
        .background(DesignTokens.surfaceSecondary)
        .clipShape(RoundedRectangle(cornerRadius: DesignTokens.cornerRadiusLarge))
    }
}

/// Quick actions for inventory management
struct QuickActionsCard: View {
    @ObservedObject var viewModel: InventoryViewModel

    var body: some View {
        VStack(spacing: DesignTokens.spacingMedium) {
            Text("Quick Actions")
                .font(DesignTokens.headlineFont)
                .frame(maxWidth: .infinity, alignment: .leading)

            HStack(spacing: DesignTokens.spacingMedium) {
                QuickActionButton(
                    title: "Add Stock",
                    icon: "plus.circle.fill",
                    color: DesignTokens.success
                ) {
                    viewModel.showingAddStock = true
                }

                QuickActionButton(
                    title: "Use Pair",
                    icon: "minus.circle.fill",
                    color: DesignTokens.warning
                ) {
                    viewModel.adjustInventory(by: -1)
                }
            }
        }
        .padding(DesignTokens.spacingLarge)
        .background(DesignTokens.surfaceSecondary)
        .clipShape(RoundedRectangle(cornerRadius: DesignTokens.cornerRadiusLarge))
    }
}

struct QuickActionButton: View {
    let title: String
    let icon: String
    let color: Color
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            VStack(spacing: DesignTokens.spacingSmall) {
                Image(systemName: icon)
                    .font(.system(size: 28))
                    .foregroundStyle(color)

                Text(title)
                    .font(DesignTokens.captionFont)
            }
            .frame(maxWidth: .infinity)
            .padding()
            .background(color.opacity(0.1))
            .clipShape(RoundedRectangle(cornerRadius: DesignTokens.cornerRadiusMedium))
        }
        .buttonStyle(.plain)
    }
}

/// Sheet for adding stock
struct AddStockSheet: View {
    @ObservedObject var viewModel: InventoryViewModel
    @Environment(\.dismiss) private var dismiss

    @State private var quantity = 1

    var body: some View {
        NavigationStack {
            VStack(spacing: DesignTokens.spacingLarge) {
                Text("How many pairs?")
                    .font(DesignTokens.title2Font)

                Stepper(value: $quantity, in: 1...100) {
                    Text("\(quantity)")
                        .font(.system(size: 48, weight: .bold, design: .rounded))
                        .frame(maxWidth: .infinity)
                }
                .padding()

                HStack(spacing: DesignTokens.spacingMedium) {
                    ForEach([5, 10, 30], id: \.self) { preset in
                        Button("+\(preset)") {
                            quantity = preset
                        }
                        .buttonStyle(.bordered)
                    }
                }

                Spacer()

                Button {
                    viewModel.addStock(quantity)
                    dismiss()
                } label: {
                    Text("Add \(quantity) Pair\(quantity == 1 ? "" : "s")")
                        .font(DesignTokens.headlineFont)
                        .foregroundStyle(.white)
                        .frame(maxWidth: .infinity)
                        .padding()
                        .background(DesignTokens.success)
                        .clipShape(RoundedRectangle(cornerRadius: DesignTokens.cornerRadiusMedium))
                }
            }
            .padding(DesignTokens.spacingMedium)
            .navigationTitle("Add Stock")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    Button("Cancel") {
                        dismiss()
                    }
                }
            }
        }
        .presentationDetents([.medium])
    }
}

/// Sheet for editing lens profile
struct LensProfileSheet: View {
    @ObservedObject var viewModel: InventoryViewModel
    @Environment(\.dismiss) private var dismiss

    @State private var lensType: LensType = .monthly
    @State private var brandName = ""
    @State private var customCycleDays = ""

    var body: some View {
        NavigationStack {
            Form {
                Section("Lens Type") {
                    Picker("Type", selection: $lensType) {
                        ForEach(LensType.allCases, id: \.self) { type in
                            Text(type.displayName).tag(type)
                        }
                    }

                    Text(lensType.description)
                        .font(DesignTokens.captionFont)
                        .foregroundStyle(.secondary)
                }

                Section("Brand (Optional)") {
                    TextField("Brand name", text: $brandName)
                }

                Section("Replacement Cycle") {
                    TextField(
                        "Days (default: \(lensType.defaultCycleDays))",
                        text: $customCycleDays
                    )
                    .keyboardType(.numberPad)
                }
            }
            .navigationTitle("Lens Profile")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    Button("Cancel") {
                        dismiss()
                    }
                }

                ToolbarItem(placement: .topBarTrailing) {
                    Button("Save") {
                        let cycleDays = Int(customCycleDays)
                        viewModel.saveLensProfile(
                            type: lensType,
                            brandName: brandName.isEmpty ? nil : brandName,
                            customCycleDays: cycleDays
                        )
                        dismiss()
                    }
                }
            }
            .onAppear {
                if let profile = viewModel.lensProfile {
                    lensType = profile.lensType
                    brandName = profile.brandName ?? ""
                    if profile.replacementCycleDays != profile.lensType.defaultCycleDays {
                        customCycleDays = "\(profile.replacementCycleDays)"
                    }
                }
            }
        }
    }
}

#Preview {
    InventoryView(
        viewModel: InventoryViewModel(
            modelContext: try! ModelContainer(for: Inventory.self).mainContext,
            notificationService: NotificationService()
        )
    )
}
