import SwiftUI

struct SectionHeader: View {
    let title: String
    var subtitle: String? = nil
    var actionLabel: String? = nil
    var onAction: (() -> Void)? = nil
    let theme: ThemeColors

    var body: some View {
        HStack(alignment: .center) {
            VStack(alignment: .leading, spacing: 4) {
                Text(title)
                    .font(.system(size: 24, weight: .heavy, design: .rounded))
                    .foregroundStyle(theme.text)
                if let subtitle {
                    Text(subtitle)
                        .font(.system(size: 14))
                        .foregroundStyle(theme.textSecondary)
                }
            }
            Spacer()
            if let actionLabel, let onAction {
                Button(action: onAction) {
                    HStack(spacing: 6) {
                        Image(systemName: "plus")
                            .font(.system(size: 12, weight: .bold))
                        Text(actionLabel)
                            .font(.system(size: 13, weight: .bold))
                    }
                    .foregroundStyle(.white)
                    .padding(.horizontal, 16)
                    .padding(.vertical, 10)
                    .background(theme.accent)
                    .clipShape(.rect(cornerRadius: 12))
                }
                .buttonStyle(.plain)
            }
        }
        .padding(.bottom, 18)
    }
}
