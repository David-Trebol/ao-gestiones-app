import SwiftUI

struct StatusBadge: View {
    let status: OrderStatus
    var size: Size = .default
    let theme: ThemeColors

    enum Size { case `default`, small }

    var body: some View {
        let sc = statusColors(for: status, theme: theme)
        let isSmall = size == .small
        let fontSize: CGFloat = isSmall ? 10 : 12
        let hPad: CGFloat = isSmall ? 7 : 11
        let vPad: CGFloat = isSmall ? 3 : 5
        let iconSize: CGFloat = isSmall ? 9 : 12

        HStack(spacing: 4) {
            Image(systemName: status.sfSymbol)
                .font(.system(size: iconSize, weight: .semibold))
            Text(isSmall ? status.shortLabel : status.label)
                .font(.system(size: fontSize, weight: .semibold))
        }
        .foregroundStyle(sc.text)
        .padding(.horizontal, hPad)
        .padding(.vertical, vPad)
        .background(sc.bg)
        .clipShape(.rect(cornerRadius: 100))
    }
}
