import SwiftUI
import UIKit

struct KasaTabBar: View {
    @EnvironmentObject private var browser: KasaBrowserModel
    @Namespace private var selectionAnimation

    var body: some View {
        HStack(spacing: 5) {
            ForEach(KasaDestination.allCases) { destination in
                tab(destination)
            }
        }
        .padding(.horizontal, 10)
        .padding(.top, 9)
        .padding(.bottom, 7)
        .background(.ultraThinMaterial)
        .overlay(alignment: .top) {
            Divider().opacity(0.5)
        }
    }

    private func tab(_ destination: KasaDestination) -> some View {
        let isSelected = browser.selectedDestination == destination

        return Button {
            UIImpactFeedbackGenerator(style: .light).impactOccurred()
            browser.load(path: destination.path)
        } label: {
            VStack(spacing: 4) {
                ZStack {
                    if isSelected {
                        Capsule()
                            .fill(Color.indigo.opacity(0.12))
                            .matchedGeometryEffect(id: "selection", in: selectionAnimation)
                            .frame(width: 48, height: 28)
                    }

                    Image(systemName: destination.systemImage)
                        .font(.system(size: destination == .live ? 22 : 19, weight: .semibold))
                        .symbolRenderingMode(.hierarchical)
                }
                .frame(height: 28)

                Text(destination.title)
                    .font(.caption2.weight(isSelected ? .bold : .medium))
                    .lineLimit(1)
            }
            .foregroundStyle(isSelected ? Color.indigo : Color.secondary)
            .frame(maxWidth: .infinity)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityLabel(destination.title)
        .accessibilityAddTraits(isSelected ? .isSelected : [])
    }
}
