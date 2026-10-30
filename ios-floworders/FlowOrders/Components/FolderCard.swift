import SwiftUI

struct FolderCard: View {
    let icon: String
    let title: String
    var subtitle: String? = nil
    var badges: [(label: String, color: Color)] = []
    var totalLabel: String? = nil
    var totalValue: String? = nil
    let theme: ThemeColors
    var onPress: () -> Void
    var onDuplicate: (() -> Void)? = nil

    @State private var isPressed = false

    var body: some View {
        Button(action: onPress) {
            VStack(alignment: .leading, spacing: 0) {
                // Header
                HStack(alignment: .top) {
                    Image(systemName: icon)
                        .font(.system(size: 20, weight: .semibold))
                        .foregroundStyle(theme.primary)
                        .frame(width: 44, height: 44)
                        .background(theme.primarySoft)
                        .clipShape(.rect(cornerRadius: 13))

                    Spacer()

                    HStack(alignment: .top, spacing: 6) {
                        if let onDuplicate {
                            Button(action: onDuplicate) {
                                Image(systemName: "doc.on.doc")
                                    .font(.system(size: 11, weight: .semibold))
                                    .foregroundStyle(theme.primary)
                                    .frame(width: 28, height: 28)
                                    .background(theme.primarySoft)
                                    .clipShape(.rect(cornerRadius: 8))
                            }
                            .buttonStyle(.plain)
                        }

                        VStack(alignment: .trailing, spacing: 5) {
                            ForEach(badges.indices, id: \.self) { i in
                                Text(badges[i].label)
                                    .font(.system(size: 10, weight: .bold))
                                    .foregroundStyle(.white)
                                    .padding(.horizontal, 9)
                                    .padding(.vertical, 3)
                                    .background(badges[i].color)
                                    .clipShape(.rect(cornerRadius: 100))
                            }
                        }
                    }
                }
                .padding(.bottom, 12)

                // Title
                Text(title)
                    .font(.system(size: 19, weight: .heavy, design: .rounded))
                    .foregroundStyle(theme.text)
                    .lineLimit(1)

                if let subtitle {
                    Text(subtitle)
                        .font(.system(size: 12))
                        .foregroundStyle(theme.textSecondary)
                        .lineLimit(1)
                        .padding(.top, 2)
                }

                if let totalLabel, let totalValue {
                    HStack {
                        Text(totalLabel)
                            .font(.system(size: 12))
                            .foregroundStyle(theme.textSecondary)
                        Spacer()
                        Text(totalValue)
                            .font(.system(size: 14, weight: .bold))
                            .foregroundStyle(theme.text)
                    }
                    .padding(.top, 10)
                }

                // Footer
                HStack(spacing: 3) {
                    Text("Ver detalles")
                        .font(.system(size: 13, weight: .semibold))
                        .foregroundStyle(theme.primary)
                    Image(systemName: "chevron.right")
                        .font(.system(size: 11, weight: .semibold))
                        .foregroundStyle(theme.primary)
                }
                .padding(.top, 14)
                .overlay(
                    Rectangle()
                        .fill(theme.divider)
                        .frame(height: 1),
                    alignment: .top
                )
            }
            .padding(16)
            .frame(maxWidth: .infinity, minHeight: 182, alignment: .top)
            .background(theme.surfaceElevated)
            .clipShape(.rect(cornerRadius: 18))
            .overlay(
                .rect(cornerRadius: 18)
                    .stroke(theme.borderLight, lineWidth: 1)
            )
            .shadow(color: theme.cardShadow, radius: 16, y: 6)
            .scaleEffect(isPressed ? 0.95 : 1.0)
            .animation(.spring(response: 0.3, dampingFraction: 0.6), value: isPressed)
        }
        .buttonStyle(.plain)
        .simultaneousGesture(
            DragGesture(minimumDistance: 0)
                .onChanged { _ in isPressed = true }
                .onEnded { _ in isPressed = false }
        )
        .contextMenu {
            if let onDuplicate {
                Button("Duplicar", systemImage: "doc.on.doc") {
                    onDuplicate()
                }
            }
        }
    }
}
