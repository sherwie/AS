# LensMate

A focused health companion iOS app with Apple Watch support that helps contact lens wearers track wear time, monitor eye health, and maintain safe lens habits.

## Features

- **Wear Tracking**: One-tap start/stop from iPhone or Apple Watch
- **Eye Health Logging**: Track comfort scores and symptoms
- **Smart Insights**: Personalized recommendations based on your patterns
- **Lens Replacement Reminders**: Never forget when to replace your lenses
- **Inventory Management**: Track your lens stock
- **PDF Reports**: Generate doctor-ready reports
- **iCloud Sync**: Seamless sync across devices

## Requirements

- iOS 17.0+
- watchOS 10.0+
- Xcode 15.0+

## Project Structure

```
LensMate/
├── LensMate/           # iOS App
│   ├── App/            # App entry point
│   ├── Models/         # SwiftData models
│   ├── ViewModels/     # MVVM view models
│   ├── Views/          # SwiftUI views
│   ├── Services/       # Business logic services
│   ├── Utilities/      # Extensions and helpers
│   └── Resources/      # Assets, configs
└── LensMateWatch/      # watchOS App
    ├── App/
    ├── Views/
    ├── ViewModels/
    └── Services/
```

## Setup Instructions

### 1. Create Xcode Project

1. Open Xcode 15 or later
2. Create a new project: **File > New > Project**
3. Select **App** under iOS
4. Configure:
   - Product Name: `LensMate`
   - Bundle Identifier: `com.lensmate.app`
   - Interface: SwiftUI
   - Storage: SwiftData
5. Add Watch target: **File > New > Target > watchOS > App**
   - Product Name: `LensMateWatch`

### 2. Add Source Files

Copy all source files from this repository into your Xcode project, maintaining the directory structure.

### 3. Configure Capabilities

#### iOS App
1. Select the LensMate target
2. Go to **Signing & Capabilities**
3. Add the following capabilities:
   - **HealthKit**
   - **iCloud** (enable CloudKit, add container: `iCloud.com.lensmate.app`)
   - **Push Notifications**
   - **Background Modes** (enable Remote notifications)

#### Watch App
1. Select the LensMateWatch target
2. Add **HealthKit** capability

### 4. Set Up Secrets

1. Copy `Secrets.plist.template` to `Secrets.plist`
2. Add any required API keys (currently none required)
3. Ensure `Secrets.plist` is in `.gitignore`

### 5. Configure CloudKit

1. Go to [CloudKit Dashboard](https://icloud.developer.apple.com/)
2. Create a new container: `iCloud.com.lensmate.app`
3. SwiftData will automatically create the schema on first run

### 6. Build and Run

1. Select your target device/simulator
2. Build and run (⌘R)

## Architecture

### MVVM Pattern
- **Models**: SwiftData entities with CloudKit sync
- **ViewModels**: Business logic with `@Observable` or `@StateObject`
- **Views**: Pure SwiftUI with minimal logic

### Dependency Injection
Services are injected via `AppContainer`:
```swift
@MainActor
final class AppContainer: ObservableObject {
    let healthKitService: HealthKitService
    let watchConnectivityService: WatchConnectivityService
    let notificationService: NotificationService
    // ...
}
```

### Data Flow
1. User interacts with View
2. View calls ViewModel method
3. ViewModel updates Model via SwiftData
4. SwiftData syncs to CloudKit
5. Watch receives updates via WatchConnectivity

## App Store Preparation

### Required Screenshots
- iPhone 6.7" (iPhone 15 Pro Max)
- iPhone 6.5" (iPhone 14 Plus)
- iPad Pro 12.9"
- Apple Watch Series 9

### Privacy Policy
Create a privacy policy covering:
- HealthKit data usage
- iCloud data storage
- No third-party data sharing
- No tracking or analytics

### HealthKit Review Guidelines
- Clearly explain health data usage in app description
- Request only necessary permissions
- Provide value to users for health data access

## Testing

### Unit Tests
```bash
xcodebuild test -scheme LensMate -destination 'platform=iOS Simulator,name=iPhone 15'
```

### UI Tests
```bash
xcodebuild test -scheme LensMateUITests -destination 'platform=iOS Simulator,name=iPhone 15'
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## License

MIT License - see LICENSE file for details.
