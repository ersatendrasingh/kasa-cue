import Foundation

enum AppConfiguration {
    static let productionOrigin = URL(string: "https://cue.getkasa.in")!
    static let allowedHosts: Set<String> = ["cue.getkasa.in"]

    static func url(for path: String) -> URL {
        let normalizedPath = path.hasPrefix("/") ? path : "/\(path)"
        return URL(string: normalizedPath, relativeTo: productionOrigin)!.absoluteURL
    }

    static func isTrusted(_ url: URL?) -> Bool {
        guard let url,
              url.scheme == "https",
              let host = url.host?.lowercased()
        else {
            return false
        }

        return allowedHosts.contains(host)
    }
}
