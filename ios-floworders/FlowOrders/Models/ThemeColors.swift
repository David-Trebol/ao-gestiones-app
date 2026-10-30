import SwiftUI

struct ThemeColors {
    let primary: Color
    let primaryDark: Color
    let primaryLight: Color
    let primarySoft: Color
    let primarySoftAlt: Color
    let accent: Color
    let accentSoft: Color
    let background: Color
    let surface: Color
    let surfaceAlt: Color
    let surfaceElevated: Color
    let text: Color
    let textSecondary: Color
    let textTertiary: Color
    let border: Color
    let borderLight: Color
    let divider: Color
    let success: Color
    let successBg: Color
    let warning: Color
    let warningBg: Color
    let error: Color
    let errorBg: Color
    let info: Color
    let infoBg: Color

    let statusPendingBg: Color
    let statusPendingText: Color
    let statusProcessingBg: Color
    let statusProcessingText: Color
    let statusShippedBg: Color
    let statusShippedText: Color
    let statusDeliveredBg: Color
    let statusDeliveredText: Color
    let statusCancelledBg: Color
    let statusCancelledText: Color

    let cardShadow: Color
    let overlay: Color
}

enum ThemeMode: String, Codable {
    case light
    case dark
}

let lightColors = ThemeColors(
    primary: Color(red: 0xD9/255, green: 0x6A/255, blue: 0x2B/255),
    primaryDark: Color(red: 0xB5/255, green: 0x52/255, blue: 0x1B/255),
    primaryLight: Color(red: 0xF2/255, green: 0x9A/255, blue: 0x61/255),
    primarySoft: Color(red: 0xD9/255, green: 0x6A/255, blue: 0x2B/255).opacity(0.10),
    primarySoftAlt: Color(red: 0xD9/255, green: 0x6A/255, blue: 0x2B/255).opacity(0.16),
    accent: Color(red: 0xF0/255, green: 0x8A/255, blue: 0x4B/255),
    accentSoft: Color(red: 0xF0/255, green: 0x8A/255, blue: 0x4B/255).opacity(0.14),
    background: Color(red: 0xEC/255, green: 0xE9/255, blue: 0xE4/255),
    surface: Color(red: 0xF7/255, green: 0xF4/255, blue: 0xEF/255),
    surfaceAlt: Color(red: 0xEE/255, green: 0xE8/255, blue: 0xE0/255),
    surfaceElevated: Color(red: 0xFF/255, green: 0xFC/255, blue: 0xF8/255),
    text: Color(red: 0x29/255, green: 0x24/255, blue: 0x1E/255),
    textSecondary: Color(red: 0x62/255, green: 0x5A/255, blue: 0x4F/255),
    textTertiary: Color(red: 0x8F/255, green: 0x85/255, blue: 0x78/255),
    border: Color(red: 0xD9/255, green: 0xD0/255, blue: 0xC3/255),
    borderLight: Color(red: 0xE7/255, green: 0xDE/255, blue: 0xD2/255),
    divider: Color(red: 0xE4/255, green: 0xDB/255, blue: 0xCE/255),
    success: Color(red: 0x05/255, green: 0x96/255, blue: 0x69/255),
    successBg: Color(red: 0xEC/255, green: 0xFD/255, blue: 0xF5/255),
    warning: Color(red: 0xD9/255, green: 0x77/255, blue: 0x06/255),
    warningBg: Color(red: 0xFF/255, green: 0xFB/255, blue: 0xEB/255),
    error: Color(red: 0xDC/255, green: 0x26/255, blue: 0x26/255),
    errorBg: Color(red: 0xFE/255, green: 0xF2/255, blue: 0xF2/255),
    info: Color(red: 0x3B/255, green: 0x82/255, blue: 0xF6/255),
    infoBg: Color(red: 0xEF/255, green: 0xF6/255, blue: 0xFF/255),
    statusPendingBg: Color(red: 0xFE/255, green: 0xF3/255, blue: 0xC7/255),
    statusPendingText: Color(red: 0x92/255, green: 0x40/255, blue: 0x0E/255),
    statusProcessingBg: Color(red: 0xDB/255, green: 0xEA/255, blue: 0xFE/255),
    statusProcessingText: Color(red: 0x1E/255, green: 0x40/255, blue: 0xAF/255),
    statusShippedBg: Color(red: 0xE0/255, green: 0xE7/255, blue: 0xFF/255),
    statusShippedText: Color(red: 0x37/255, green: 0x30/255, blue: 0xA3/255),
    statusDeliveredBg: Color(red: 0xD1/255, green: 0xFA/255, blue: 0xE5/255),
    statusDeliveredText: Color(red: 0x06/255, green: 0x5F/255, blue: 0x46/255),
    statusCancelledBg: Color(red: 0xFE/255, green: 0xE2/255, blue: 0xE2/255),
    statusCancelledText: Color(red: 0x99/255, green: 0x1B/255, blue: 0x1B/255),
    cardShadow: Color(red: 0x3F/255, green: 0x2A/255, blue: 0x1A/255).opacity(0.08),
    overlay: Color(red: 0x27/255, green: 0x1F/255, blue: 0x18/255).opacity(0.42)
)

let darkColors = ThemeColors(
    primary: Color(red: 0xFF/255, green: 0x9B/255, blue: 0x57/255),
    primaryDark: Color(red: 0xE3/255, green: 0x7B/255, blue: 0x38/255),
    primaryLight: Color(red: 0xFF/255, green: 0xC0/255, blue: 0x8D/255),
    primarySoft: Color(red: 0xFF/255, green: 0x9B/255, blue: 0x57/255).opacity(0.18),
    primarySoftAlt: Color(red: 0xFF/255, green: 0x9B/255, blue: 0x57/255).opacity(0.28),
    accent: Color(red: 0xFF/255, green: 0xAE/255, blue: 0x72/255),
    accentSoft: Color(red: 0xFF/255, green: 0xAE/255, blue: 0x72/255).opacity(0.20),
    background: Color(red: 0x31/255, green: 0x2D/255, blue: 0x29/255),
    surface: Color(red: 0x3B/255, green: 0x36/255, blue: 0x31/255),
    surfaceAlt: Color(red: 0x45/255, green: 0x40/255, blue: 0x3A/255),
    surfaceElevated: Color(red: 0x50/255, green: 0x49/255, blue: 0x41/255),
    text: Color(red: 0xFF/255, green: 0xF7/255, blue: 0xF0/255),
    textSecondary: Color(red: 0xE7/255, green: 0xD8/255, blue: 0xC7/255),
    textTertiary: Color(red: 0xC0/255, green: 0xAE/255, blue: 0x9B/255),
    border: Color(red: 0x5D/255, green: 0x54/255, blue: 0x4B/255),
    borderLight: Color(red: 0x70/255, green: 0x66/255, blue: 0x5C/255),
    divider: Color(red: 0x54/255, green: 0x4C/255, blue: 0x44/255),
    success: Color(red: 0x5A/255, green: 0xE0/255, blue: 0xA9/255),
    successBg: Color(red: 0x5A/255, green: 0xE0/255, blue: 0xA9/255).opacity(0.12),
    warning: Color(red: 0xFF/255, green: 0xC9/255, blue: 0x5C/255),
    warningBg: Color(red: 0xFF/255, green: 0xC9/255, blue: 0x5C/255).opacity(0.12),
    error: Color(red: 0xFF/255, green: 0x8A/255, blue: 0x8A/255),
    errorBg: Color(red: 0xFF/255, green: 0x8A/255, blue: 0x8A/255).opacity(0.12),
    info: Color(red: 0x7A/255, green: 0xB8/255, blue: 0xFF/255),
    infoBg: Color(red: 0x7A/255, green: 0xB8/255, blue: 0xFF/255).opacity(0.12),
    statusPendingBg: Color(red: 0xFF/255, green: 0xC9/255, blue: 0x5C/255).opacity(0.14),
    statusPendingText: Color(red: 0xFF/255, green: 0xD2/255, blue: 0x7D/255),
    statusProcessingBg: Color(red: 0x7A/255, green: 0xB8/255, blue: 0xFF/255).opacity(0.14),
    statusProcessingText: Color(red: 0x8E/255, green: 0xC5/255, blue: 0xFF/255),
    statusShippedBg: Color(red: 0x9B/255, green: 0xA5/255, blue: 0xFF/255).opacity(0.14),
    statusShippedText: Color(red: 0xAA/255, green: 0xB2/255, blue: 0xFF/255),
    statusDeliveredBg: Color(red: 0x5A/255, green: 0xE0/255, blue: 0xA9/255).opacity(0.14),
    statusDeliveredText: Color(red: 0x7D/255, green: 0xE7/255, blue: 0xB8/255),
    statusCancelledBg: Color(red: 0xFF/255, green: 0x8A/255, blue: 0x8A/255).opacity(0.14),
    statusCancelledText: Color(red: 0xFF/255, green: 0xA3/255, blue: 0xA3/255),
    cardShadow: Color(red: 0x0C/255, green: 0x09/255, blue: 0x07/255).opacity(0.18),
    overlay: Color(red: 0x14/255, green: 0x10/255, blue: 0x0D/255).opacity(0.46)
)

func themeColors(for mode: ThemeMode) -> ThemeColors {
    mode == .dark ? darkColors : lightColors
}

func statusColors(for status: OrderStatus, theme: ThemeColors) -> (bg: Color, text: Color) {
    switch status {
    case .pending: return (theme.statusPendingBg, theme.statusPendingText)
    case .processing: return (theme.statusProcessingBg, theme.statusProcessingText)
    case .shipped: return (theme.statusShippedBg, theme.statusShippedText)
    case .delivered: return (theme.statusDeliveredBg, theme.statusDeliveredText)
    case .cancelled: return (theme.statusCancelledBg, theme.statusCancelledText)
    }
}
