import Foundation

/// Manages secure access to API keys and sensitive configuration
/// Values are loaded from Secrets.plist which must not be committed to version control
enum SecretsManager {
    private static var secrets: [String: Any]? = {
        guard let url = Bundle.main.url(forResource: "Secrets", withExtension: "plist"),
              let data = try? Data(contentsOf: url),
              let plist = try? PropertyListSerialization.propertyList(from: data, format: nil) as? [String: Any]
        else {
            #if DEBUG
            print("SecretsManager: Secrets.plist not found - ensure it exists for production builds")
            #endif
            return nil
        }
        return plist
    }()

    /// Retrieve a string value for a given key
    /// - Parameter key: The key to look up in Secrets.plist
    /// - Returns: The string value if found, nil otherwise
    static func value(forKey key: String) -> String? {
        return secrets?[key] as? String
    }

    /// Retrieve an integer value for a given key
    /// - Parameter key: The key to look up in Secrets.plist
    /// - Returns: The integer value if found, nil otherwise
    static func intValue(forKey key: String) -> Int? {
        return secrets?[key] as? Int
    }

    /// Retrieve a boolean value for a given key
    /// - Parameter key: The key to look up in Secrets.plist
    /// - Returns: The boolean value if found, nil otherwise
    static func boolValue(forKey key: String) -> Bool? {
        return secrets?[key] as? Bool
    }

    /// Check if secrets file is available
    static var isConfigured: Bool {
        secrets != nil
    }
}
