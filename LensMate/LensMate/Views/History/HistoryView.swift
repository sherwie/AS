import SwiftUI

struct HistoryView: View {
    @StateObject var viewModel: HistoryViewModel
    @State private var showingCalendar = false

    var body: some View {
        NavigationStack {
            VStack(spacing: 0) {
                FilterPicker(selectedFilter: $viewModel.selectedFilter)
                    .padding(.horizontal, DesignTokens.spacingMedium)
                    .padding(.vertical, DesignTokens.spacingSmall)

                if let stats = viewModel.statistics {
                    StatisticsCard(statistics: stats)
                        .padding(.horizontal, DesignTokens.spacingMedium)
                        .padding(.bottom, DesignTokens.spacingSmall)
                }

                if viewModel.dailyGroups.isEmpty {
                    EmptyHistoryView()
                } else {
                    List {
                        ForEach(viewModel.dailyGroups) { group in
                            Section {
                                ForEach(group.sessions) { session in
                                    NavigationLink(destination: SessionDetailView(session: session)) {
                                        SessionRowView(session: session)
                                    }
                                    .swipeActions(edge: .trailing, allowsFullSwipe: false) {
                                        Button(role: .destructive) {
                                            viewModel.deleteSession(session)
                                        } label: {
                                            Label("Delete", systemImage: "trash")
                                        }
                                    }
                                }
                            } header: {
                                HStack {
                                    Text(group.formattedDate)
                                    Spacer()
                                    Text(group.formattedTotal)
                                        .foregroundStyle(.secondary)
                                }
                            }
                        }
                    }
                    .listStyle(.insetGrouped)
                }
            }
            .background(DesignTokens.surface)
            .navigationTitle(AppStrings.Tabs.history)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button {
                        showingCalendar.toggle()
                    } label: {
                        Image(systemName: "calendar")
                    }
                }
            }
            .sheet(isPresented: $showingCalendar) {
                CalendarSheet(
                    viewModel: viewModel,
                    isPresented: $showingCalendar
                )
            }
            .onAppear {
                viewModel.loadData()
            }
        }
    }
}

/// Filter picker for time range selection
struct FilterPicker: View {
    @Binding var selectedFilter: HistoryFilter

    var body: some View {
        Picker("Time Range", selection: $selectedFilter) {
            ForEach(HistoryFilter.allCases, id: \.self) { filter in
                Text(filter.rawValue).tag(filter)
            }
        }
        .pickerStyle(.segmented)
    }
}

/// Statistics summary card
struct StatisticsCard: View {
    let statistics: HistoryStatistics

    var body: some View {
        HStack(spacing: DesignTokens.spacingMedium) {
            StatItem(title: "Days", value: "\(statistics.totalWearDays)")
            Divider().frame(height: 30)
            StatItem(title: "Total", value: statistics.formattedTotalWear)
            Divider().frame(height: 30)
            StatItem(title: "Avg/Day", value: statistics.formattedAverageDaily)
            if let comfort = statistics.formattedAverageComfort {
                Divider().frame(height: 30)
                StatItem(title: "Comfort", value: comfort)
            }
        }
        .padding(DesignTokens.spacingMedium)
        .background(DesignTokens.surfaceSecondary)
        .clipShape(RoundedRectangle(cornerRadius: DesignTokens.cornerRadiusMedium))
    }
}

struct StatItem: View {
    let title: String
    let value: String

    var body: some View {
        VStack(spacing: DesignTokens.spacingXSmall) {
            Text(title)
                .font(DesignTokens.caption2Font)
                .foregroundStyle(.secondary)

            Text(value)
                .font(DesignTokens.headlineFont)
        }
    }
}

/// Individual session row
struct SessionRowView: View {
    let session: WearSession

    var body: some View {
        HStack(spacing: DesignTokens.spacingMedium) {
            VStack(alignment: .leading, spacing: DesignTokens.spacingXSmall) {
                HStack {
                    Text(Formatters.timeOnly.string(from: session.startTime))
                    if let endTime = session.endTime {
                        Text("-")
                        Text(Formatters.timeOnly.string(from: endTime))
                    }
                }
                .font(DesignTokens.bodyFont)

                HStack(spacing: DesignTokens.spacingSmall) {
                    Image(systemName: session.source == .iPhone ? "iphone" : "applewatch")
                        .font(.caption)
                        .foregroundStyle(.secondary)

                    if let score = session.comfortScore {
                        Text("\(score)/10")
                            .font(DesignTokens.captionFont)
                            .foregroundStyle(.secondary)
                    }
                }
            }

            Spacer()

            Text(session.formattedDuration)
                .font(DesignTokens.headlineFont)
                .foregroundStyle(DesignTokens.primaryAction)
        }
        .padding(.vertical, DesignTokens.spacingXSmall)
    }
}

/// Empty state view
struct EmptyHistoryView: View {
    var body: some View {
        VStack(spacing: DesignTokens.spacingMedium) {
            Spacer()

            Image(systemName: "clock.arrow.circlepath")
                .font(.system(size: 60))
                .foregroundStyle(.secondary)

            Text("No wear history yet")
                .font(DesignTokens.title3Font)

            Text("Start tracking your lens wear to see your history here.")
                .font(DesignTokens.bodyFont)
                .foregroundStyle(.secondary)
                .multilineTextAlignment(.center)
                .padding(.horizontal, DesignTokens.spacingLarge)

            Spacer()
        }
    }
}

/// Calendar sheet for date-based navigation
struct CalendarSheet: View {
    @ObservedObject var viewModel: HistoryViewModel
    @Binding var isPresented: Bool
    @State private var selectedMonth = Date()

    var body: some View {
        NavigationStack {
            VStack {
                DatePicker(
                    "Select Date",
                    selection: Binding(
                        get: { viewModel.selectedDate ?? Date() },
                        set: { viewModel.selectedDate = $0 }
                    ),
                    displayedComponents: .date
                )
                .datePickerStyle(.graphical)
                .padding()

                if let date = viewModel.selectedDate {
                    let sessions = viewModel.sessions(for: date)
                    if sessions.isEmpty {
                        Text("No sessions on this date")
                            .foregroundStyle(.secondary)
                            .padding()
                    } else {
                        List(sessions) { session in
                            SessionRowView(session: session)
                        }
                    }
                }
            }
            .navigationTitle("Calendar")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Done") {
                        isPresented = false
                    }
                }
            }
        }
        .presentationDetents([.large])
    }
}

#Preview {
    HistoryView(
        viewModel: HistoryViewModel(
            modelContext: try! ModelContainer(for: WearSession.self).mainContext
        )
    )
}
