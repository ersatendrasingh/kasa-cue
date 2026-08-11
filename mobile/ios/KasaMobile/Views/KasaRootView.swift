import SwiftUI

struct KasaRootView: View {
    @EnvironmentObject private var browser: KasaBrowserModel
    @EnvironmentObject private var connectivity: ConnectivityMonitor

    var body: some View {
        ZStack {
            Color(uiColor: .systemGroupedBackground)
                .ignoresSafeArea()

            KasaWebView()
                .ignoresSafeArea(edges: browser.shouldShowNativeNavigation ? [.bottom] : [])
                .safeAreaInset(edge: .bottom, spacing: 0) {
                    if browser.shouldShowNativeNavigation {
                        KasaTabBar()
                    }
                }

            if browser.isLoading && browser.currentURL == nil {
                KasaLaunchView()
                    .transition(.opacity)
            }

            if let message = browser.lastError {
                KasaErrorView(message: message)
                    .transition(.opacity.combined(with: .scale(scale: 0.98)))
            }
        }
        .safeAreaInset(edge: .top, spacing: 0) {
            VStack(spacing: 0) {
                if !connectivity.isConnected {
                    Label("You're offline", systemImage: "wifi.slash")
                        .font(.caption.weight(.semibold))
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 7)
                        .foregroundStyle(.white)
                        .background(Color.orange)
                }

                if browser.isLoading && browser.currentURL != nil {
                    GeometryReader { geometry in
                        Capsule()
                            .fill(Color.indigo)
                            .frame(
                                width: max(28, geometry.size.width * browser.estimatedProgress),
                                height: 2
                            )
                            .animation(.easeOut(duration: 0.18), value: browser.estimatedProgress)
                    }
                    .frame(height: 2)
                }
            }
        }
        .animation(.easeInOut(duration: 0.2), value: browser.isLoading)
        .animation(.easeInOut(duration: 0.2), value: connectivity.isConnected)
        .task {
            browser.requestInitialAudioPermissions()
        }
        .alert(
            "Allow audio access",
            isPresented: $browser.isMicrophonePermissionBlocked
        ) {
            Button("Open Settings") {
                browser.openAppSettings()
            }
            Button("Not now", role: .cancel) {}
        } message: {
            Text("Kasa needs microphone and speech-recognition access to create the live transcript. You only need to allow these once.")
        }
    }
}

private struct KasaLaunchView: View {
    @State private var isAnimating = false

    var body: some View {
        ZStack {
            LinearGradient(
                colors: [Color(red: 0.04, green: 0.06, blue: 0.12), .indigo.opacity(0.88)],
                startPoint: .topLeading,
                endPoint: .bottomTrailing
            )
            .ignoresSafeArea()

            VStack(spacing: 22) {
                ZStack {
                    Circle()
                        .fill(.white.opacity(0.12))
                        .frame(width: 108, height: 108)
                        .scaleEffect(isAnimating ? 1.08 : 0.94)

                    Circle()
                        .fill(.white)
                        .frame(width: 78, height: 78)
                        .shadow(color: .black.opacity(0.18), radius: 24, y: 12)

                    Image(systemName: "waveform.badge.mic")
                        .font(.system(size: 31, weight: .semibold))
                        .foregroundStyle(Color.indigo)
                }

                VStack(spacing: 6) {
                    Text("Kasa")
                        .font(.system(size: 34, weight: .bold, design: .rounded))
                    Text("Your communication copilot")
                        .font(.subheadline.weight(.medium))
                        .foregroundStyle(.white.opacity(0.72))
                }
                .foregroundStyle(.white)

                ProgressView()
                    .tint(.white)
                    .controlSize(.regular)
            }
        }
        .onAppear {
            withAnimation(.easeInOut(duration: 1.1).repeatForever(autoreverses: true)) {
                isAnimating = true
            }
        }
    }
}

private struct KasaErrorView: View {
    @EnvironmentObject private var browser: KasaBrowserModel
    let message: String

    var body: some View {
        VStack(spacing: 18) {
            Image(systemName: "wifi.exclamationmark")
                .font(.system(size: 36, weight: .medium))
                .foregroundStyle(.orange)

            VStack(spacing: 7) {
                Text("Connection interrupted")
                    .font(.title3.weight(.bold))
                Text(message)
                    .font(.subheadline)
                    .multilineTextAlignment(.center)
                    .foregroundStyle(.secondary)
            }

            Button {
                browser.reload()
            } label: {
                Label("Try again", systemImage: "arrow.clockwise")
                    .font(.headline)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 13)
            }
            .buttonStyle(.borderedProminent)
            .tint(.indigo)
        }
        .padding(24)
        .frame(maxWidth: 340)
        .background(.regularMaterial, in: RoundedRectangle(cornerRadius: 28, style: .continuous))
        .shadow(color: .black.opacity(0.12), radius: 30, y: 16)
        .padding(24)
    }
}
