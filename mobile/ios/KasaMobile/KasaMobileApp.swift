import SwiftUI

@main
struct KasaMobileApp: App {
    @StateObject private var browser = KasaBrowserModel()
    @StateObject private var connectivity = ConnectivityMonitor()

    var body: some Scene {
        WindowGroup {
            KasaRootView()
                .environmentObject(browser)
                .environmentObject(connectivity)
                .preferredColorScheme(.light)
        }
    }
}
