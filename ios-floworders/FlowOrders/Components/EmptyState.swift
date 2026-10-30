import SwiftUI

struct EmptyState: View {
    var icon: String = "shippingbox"
    let title: String
    let description: String
    var actionLabel: String? = nil
    var onAction: (() -> Void)? = nil
    let theme: ThemeColors

    var body: some View {
        VStack(spacing: 0) {
            VStack(spacing: 0) {
                Image(systemName: icon)
                    .font(.system(size: 36, weight: .medium))
                    .foregroundStyle(theme.textTertiary)
            }
            .frame(width: 84, height: 84)
            .background(theme.surfaceAlt)
            .clipShape(.rect(cornerRadius: 24))
            .padding(.bottom, 20)

            Text(title)
                .font(.system(size: 19, weight: .bold, design: .rounded))
                .foregroundStyle(theme.text)
                .padding(.bottom, 8)

            Text(description)
                .font(.system(size: 14))
                .foregroundStyle(theme.textSecondary)
                .multilineTextAlignment(.center)
                .lineSpacing(4)

            if let actionLabel, let onAction {
                Button(action: onAction) {
                    HStack(spacing: 8) {
                        Image(systemName: "plus")
                            .font(.system(size: 14, weight: .bold))
                        Text(actionLabel)
                            .font(.system(size: 15, weight: .bold))
                    }
                    .foregroundStyle(.white)
                    .padding(.horizontal, 22)
                    .padding(.vertical, 13)
                    .background(theme.accent)
                    .clipShape(.rect(cornerRadius: 14))
                }
                .buttonStyle(.plain)
                .padding(.top, 28)
            }
        }
        .padding(.horizontal, 36)
        .padding(.vertical, 64)
        .frame(maxWidth: .infinity)
    }
}
