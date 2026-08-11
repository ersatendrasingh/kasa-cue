import Foundation

enum KasaDestination: String, CaseIterable, Identifiable {
    case home
    case live
    case sessions
    case settings

    var id: String { rawValue }

    var title: String {
        switch self {
        case .home: "Home"
        case .live: "Start"
        case .sessions: "History"
        case .settings: "Settings"
        }
    }

    var systemImage: String {
        switch self {
        case .home: "house.fill"
        case .live: "waveform.circle.fill"
        case .sessions: "clock.arrow.circlepath"
        case .settings: "slider.horizontal.3"
        }
    }

    var path: String {
        switch self {
        case .home: "/dashboard"
        case .live: "/dashboard?startSession=1"
        case .sessions: "/dashboard/sessions"
        case .settings: "/dashboard/instructions"
        }
    }
}
