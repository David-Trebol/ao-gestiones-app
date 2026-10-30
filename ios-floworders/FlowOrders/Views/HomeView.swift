import SwiftUI

enum HomeNavView: Equatable {
    case years
    case manufacturers
    case orders
    case detail
}

struct HomeView: View {
    @Environment(AppStore.self) private var store
    @Binding var currentView: HomeNavView
    @Binding var selectedYear: Int?
    @Binding var selectedManufacturer: Manufacturer?
    @State private var showYearModal = false
    @State private var yearInput = String(Calendar.current.component(.year, from: Date()))
    @State private var showOrderForm = false
    @State private var showOrderDetail = false
    @State private var selectedOrderId: UUID?

    private var theme: ThemeColors { themeColors(for: store.themeMode) }
    private var isDark: Bool { store.themeMode == .dark }

    private var allYears: [Int] { store.allYears }

    private let gridColumns = [
        GridItem(.flexible(), spacing: 12),
        GridItem(.flexible(), spacing: 12),
    ]

    var body: some View {
        ScrollView {
            VStack(spacing: 0) {
                if currentView != .years {
                    backButton
                }

                breadcrumbs

                contentArea
                    .padding(.bottom, 100)
            }
            .padding(.horizontal, 20)
            .animation(.spring(response: 0.4, dampingFraction: 0.8), value: currentView)
        }
        .background(theme.background.ignoresSafeArea())
        .scrollIndicators(.hidden)
        .overlay(alignment: .bottomTrailing) {
            if currentView == .years {
                Button {
                    showOrderForm = true
                } label: {
                    Image(systemName: "plus")
                        .font(.system(size: 24, weight: .bold))
                        .foregroundStyle(.white)
                        .frame(width: 58, height: 58)
                        .background(theme.accent)
                        .clipShape(.rect(cornerRadius: 18))
                        .shadow(color: theme.accent.opacity(0.3), radius: 12, y: 6)
                }
                .buttonStyle(.plain)
                .padding(.trailing, 20)
                .padding(.bottom, 20)
                .transition(.scale.combined(with: .opacity))
            }
        }
        .sheet(isPresented: $showYearModal) {
            yearModal
        }
        .sheet(isPresented: $showOrderForm) {
            NavigationStack {
                OrderFormView(
                    editOrderId: nil,
                    presetManufacturerId: nil,
                    presetYear: nil
                )
            }
        }
        .sheet(isPresented: $showOrderDetail) {
            if let id = selectedOrderId {
                NavigationStack {
                    OrderDetailView(orderId: id)
                }
            }
        }
        .navigationTitle("Gestión de Pedidos")
        .navigationBarTitleDisplayMode(.inline)
    }

    // MARK: - Back button

    private var backButton: some View {
        HStack(spacing: 4) {
            Image(systemName: "chevron.left")
                .font(.system(size: 18, weight: .semibold))
                .foregroundStyle(theme.primary)
            Text("Atrás")
                .font(.system(size: 15, weight: .semibold))
                .foregroundStyle(theme.primary)
            Spacer()
        }
        .padding(.top, 8)
        .padding(.bottom, 4)
        .onTapGesture {
            navigateBack()
        }
    }

    // MARK: - Breadcrumbs

    private var breadcrumbs: some View {
        Group {
            if currentView != .years {
                HStack(spacing: 6) {
                    Button {
                        currentView = .years
                        selectedYear = nil
                        selectedManufacturer = nil
                    } label: {
                        HStack(spacing: 4) {
                            Image(systemName: "house")
                                .font(.system(size: 11))
                            Text("Inicio")
                                .font(.system(size: 13, weight: .medium))
                        }
                        .foregroundStyle(theme.primary)
                    }
                    .buttonStyle(.plain)

                    if let yr = selectedYear {
                        Image(systemName: "chevron.right")
                            .font(.system(size: 10))
                            .foregroundStyle(theme.textTertiary)

                        Button {
                            currentView = .manufacturers
                            selectedManufacturer = nil
                        } label: {
                            Text("\(yr)")
                                .font(.system(size: 13, weight: currentView == .manufacturers ? .bold : .medium))
                                .foregroundStyle(currentView == .manufacturers ? theme.text : theme.primary)
                        }
                        .buttonStyle(.plain)
                    }

                    if let mfr = selectedManufacturer {
                        Image(systemName: "chevron.right")
                            .font(.system(size: 10))
                            .foregroundStyle(theme.textTertiary)

                        Text(mfr.name)
                            .font(.system(size: 13, weight: .bold))
                            .foregroundStyle(theme.text)
                            .lineLimit(1)
                    }
                }
                .padding(.top, 8)
                .padding(.bottom, 14)
            }
        }
    }

    // MARK: - Content

    @ViewBuilder
    private var contentArea: some View {
        switch currentView {
        case .years:
            yearsView
        case .manufacturers:
            manufacturersView
        case .orders:
            ordersView
        case .detail:
            EmptyView()
        }
    }

    // MARK: - Years view

    private var yearsView: some View {
        VStack(spacing: 0) {
            if allYears.isEmpty {
                EmptyState(
                    title: "No hay años creados",
                    description: "Crea tu primer año para comenzar a gestionar pedidos",
                    actionLabel: "Añadir Año",
                    onAction: { showYearModal = true },
                    theme: theme
                )
            } else {
                SectionHeader(
                    title: "Pedidos por Año",
                    subtitle: "Selecciona un año para ver los fabricantes",
                    actionLabel: "Añadir",
                    onAction: { showYearModal = true },
                    theme: theme
                )

                LazyVGrid(columns: gridColumns, spacing: 12) {
                    ForEach(Array(allYears.enumerated()), id: \.element) { index, year in
                        let yearOrders = store.ordersByYear(year)
                        let mfrs = store.manufacturersForYear(year)
                        let total = yearOrders.reduce(0) { $0 + $1.total_with_vat }

                        FolderCard(
                            icon: "folder.open",
                            title: "\(year)",
                            badges: [
                                ("\(yearOrders.count) pedido\(yearOrders.count != 1 ? "s" : "")", theme.accent),
                                ("\(mfrs.count) fab.", theme.primary),
                            ],
                            totalLabel: "Total",
                            totalValue: Calculations.formatCurrency(total),
                            theme: theme,
                            onPress: {
                                selectedYear = year
                                selectedManufacturer = nil
                                currentView = .manufacturers
                            },
                            onDuplicate: { handleDuplicateYear(year) }
                        )
                        .transition(.scale.combined(with: .opacity).combined(with: .offset(y: 40)))
                    }
                }
            }
        }
    }

    // MARK: - Manufacturers view

    private var manufacturersView: some View {
        Group {
            if let yr = selectedYear {
                let mfrs = store.manufacturersForYear(yr)
                let yearOrders = store.ordersByYear(yr)

                if mfrs.isEmpty {
                    EmptyState(
                        title: "No hay fabricantes en \(yr)",
                        description: "Añade un fabricante a este año desde la Gestión de Fabricantes",
                        theme: theme
                    )
                } else {
                    VStack(spacing: 0) {
                        SectionHeader(
                            title: "Fabricantes en \(yr)",
                            subtitle: "Selecciona un fabricante para ver sus pedidos",
                            theme: theme
                        )

                        LazyVGrid(columns: gridColumns, spacing: 12) {
                            ForEach(mfrs) { mfr in
                                let mfOrders = yearOrders.filter { $0.manufacturer_id == mfr.id.uuidString }
                                let total = mfOrders.reduce(0) { $0 + $1.total_with_vat }

                                FolderCard(
                                    icon: "building.2",
                                    title: mfr.name,
                                    subtitle: mfr.code,
                                    badges: [
                                        ("\(mfOrders.count) pedido\(mfOrders.count != 1 ? "s" : "")", theme.accent),
                                    ],
                                    totalLabel: "Total",
                                    totalValue: Calculations.formatCurrency(total),
                                    theme: theme,
                                    onPress: {
                                        selectedManufacturer = mfr
                                        currentView = .orders
                                    }
                                )
                                .transition(.scale.combined(with: .opacity).combined(with: .offset(y: 40)))
                            }
                        }
                    }
                }
            } else {
                EmptyView()
            }
        }
    }

    // MARK: - Orders view

    private var ordersView: some View {
        Group {
            if let yr = selectedYear, let mfr = selectedManufacturer {
                let filteredOrders = store.ordersByManufacturerAndYear(mfr.id, year: yr)

                if filteredOrders.isEmpty {
                    EmptyState(
                        title: "No hay pedidos",
                        description: "No se encontraron pedidos para este fabricante",
                        actionLabel: "Nuevo Pedido",
                        onAction: { showOrderForm = true },
                        theme: theme
                    )
                } else {
                    VStack(spacing: 0) {
                        SectionHeader(
                            title: "Pedidos",
                            subtitle: "Toca un pedido para ver los detalles",
                            actionLabel: "Nuevo",
                            onAction: { showOrderForm = true },
                            theme: theme
                        )

                        LazyVGrid(columns: gridColumns, spacing: 12) {
                            ForEach(filteredOrders) { order in
                                OrderCardView(
                                    order: order,
                                    theme: theme,
                                    onTap: {
                                        selectedOrderId = order.id
                                        showOrderDetail = true
                                    },
                                    onDuplicate: {
                                        handleDuplicateOrder(order)
                                    }
                                )
                            }
                        }
                    }
                }
            } else {
                EmptyView()
            }
        }
    }

    // MARK: - Year modal

    private var yearModal: some View {
        VStack(spacing: 0) {
            Text("Añadir Año")
                .font(.system(size: 21, weight: .heavy, design: .rounded))
                .foregroundStyle(theme.text)
                .padding(.bottom, 4)

            Text("Introduce el año que quieres crear:")
                .font(.system(size: 14))
                .foregroundStyle(theme.textSecondary)
                .padding(.bottom, 20)

            TextField("Ej: 2026", text: $yearInput)
                .font(.system(size: 20, weight: .bold))
                .foregroundStyle(theme.text)
                .keyboardType(.numberPad)
                .multilineTextAlignment(.center)
                .padding(.horizontal, 16)
                .padding(.vertical, 14)
                .background(theme.background)
                .overlay(
                    .rect(cornerRadius: 14)
                        .stroke(theme.border, lineWidth: 1)
                )
                .clipShape(.rect(cornerRadius: 14))

            HStack(spacing: 12) {
                Button("Cancelar") {
                    showYearModal = false
                }
                .font(.system(size: 14, weight: .semibold))
                .foregroundStyle(theme.textSecondary)
                .padding(.horizontal, 22)
                .padding(.vertical, 12)
                .overlay(
                    .rect(cornerRadius: 12)
                        .stroke(theme.border, lineWidth: 1)
                )
                .clipShape(.rect(cornerRadius: 12))

                Button("Añadir") {
                    confirmAddYear()
                }
                .font(.system(size: 14, weight: .bold))
                .foregroundStyle(.white)
                .padding(.horizontal, 22)
                .padding(.vertical, 12)
                .background(theme.primary)
                .clipShape(.rect(cornerRadius: 12))
            }
            .padding(.top, 24)
            .overlay(
                Rectangle().fill(theme.divider).frame(height: 1),
                alignment: .top
            )
            .padding(.top, 18)
        }
        .padding(28)
        .background(theme.surface)
        .clipShape(.rect(cornerRadius: 24))
        .frame(maxWidth: 380)
        .presentationDetents([.height(280)])
    }

    // MARK: - Actions

    private func navigateBack() {
        if currentView == .orders {
            selectedManufacturer = nil
            currentView = .manufacturers
        } else if currentView == .manufacturers {
            selectedYear = nil
            currentView = .years
        }
    }

    private func confirmAddYear() {
        guard let year = Int(yearInput), year >= 2000, year <= 2100 else { return }
        _ = store.addYear(year)
        showYearModal = false
    }

    private func handleDuplicateYear(_ year: Int) {
        let nextYear = year + 1
        let alert = UIAlertController(
            title: "Duplicar año \(year)",
            message: "¿Quieres crear el año \(nextYear) con una copia de los pedidos de \(year)?",
            preferredStyle: .alert
        )
        alert.addAction(UIAlertAction(title: "Solo año", style: .default) { _ in
            if !store.addYear(nextYear) {
                // Already exists
            }
        })
        alert.addAction(UIAlertAction(title: "Año + pedidos", style: .default) { _ in
            _ = store.addYear(nextYear)
            let yearOrders = store.ordersByYear(year)
            for order in yearOrders {
                _ = store.duplicateOrder(order.id, targetYear: nextYear)
            }
        })
        alert.addAction(UIAlertAction(title: "Cancelar", style: .cancel))
        UIApplication.shared.topVC()?.present(alert, animated: true)
    }

    private func handleDuplicateOrder(_ order: Order) {
        let alert = UIAlertController(
            title: "Duplicar pedido",
            message: "¿Duplicar \"\(order.reference_number)\"?",
            preferredStyle: .alert
        )
        alert.addAction(UIAlertAction(title: "Cancelar", style: .cancel))
        alert.addAction(UIAlertAction(title: "Duplicar", style: .default) { _ in
            _ = store.duplicateOrder(order.id)
        })
        UIApplication.shared.topVC()?.present(alert, animated: true)
    }
}

// MARK: - Order Card

struct OrderCardView: View {
    let order: Order
    let theme: ThemeColors
    var onTap: () -> Void
    var onDuplicate: () -> Void
    @State private var isPressed = false

    var body: some View {
        Button(action: onTap) {
            VStack(alignment: .leading, spacing: 0) {
                // Header
                HStack {
                    Image(systemName: "doc.text")
                        .font(.system(size: 15, weight: .semibold))
                        .foregroundStyle(theme.primary)
                        .frame(width: 36, height: 36)
                        .background(theme.primarySoft)
                        .clipShape(.rect(cornerRadius: 11))

                    Spacer()

                    HStack(spacing: 6) {
                        Button(action: onDuplicate) {
                            Image(systemName: "doc.on.doc")
                                .font(.system(size: 10, weight: .semibold))
                                .foregroundStyle(theme.primary)
                                .frame(width: 28, height: 28)
                                .background(theme.primarySoft)
                                .clipShape(.rect(cornerRadius: 8))
                        }
                        .buttonStyle(.plain)

                        StatusBadge(status: order.status, size: .small, theme: theme)
                    }
                }
                .padding(.bottom, 12)

                Text("REFERENCIA")
                    .font(.system(size: 10, weight: .bold))
                    .tracking(0.5)
                    .foregroundStyle(theme.textTertiary)

                Text(order.reference_number)
                    .font(.system(size: 13, weight: .heavy, design: .monospaced))
                    .foregroundStyle(theme.text)
                    .lineLimit(1)
                    .padding(.bottom, 6)

                if !order.custom_reference.isEmpty {
                    HStack(spacing: 5) {
                        VStack(alignment: .leading, spacing: 2) {
                            Text("REF. MANUAL")
                                .font(.system(size: 9, weight: .semibold))
                                .tracking(0.5)
                                .foregroundStyle(theme.textTertiary)
                            Text(order.custom_reference)
                                .font(.system(size: 12, weight: .bold))
                                .foregroundStyle(theme.primary)
                                .lineLimit(1)
                        }
                        Spacer()
                    }
                    .padding(.horizontal, 10)
                    .padding(.vertical, 6)
                    .background(theme.primarySoft)
                    .clipShape(.rect(cornerRadius: 8))
                    .overlay(
                        Rectangle().fill(theme.accent).frame(width: 3),
                        alignment: .leading
                    )
                    .clipShape(.rect(cornerRadius: 8))
                    .padding(.bottom, 8)
                }

                Text(order.customer.nombre_empresa)
                    .font(.system(size: 13, weight: .semibold))
                    .foregroundStyle(theme.textSecondary)
                    .lineLimit(1)
                    .padding(.bottom, 10)

                // Total
                HStack {
                    Text("Total")
                        .font(.system(size: 11))
                        .foregroundStyle(theme.textTertiary)
                    Spacer()
                    Text(Calculations.formatCurrency(order.total_with_vat))
                        .font(.system(size: 16, weight: .heavy))
                        .foregroundStyle(theme.text)
                }
                .padding(.top, 10)
                .overlay(
                    Rectangle().fill(theme.divider).frame(height: 1),
                    alignment: .top
                )

                // Footer
                HStack {
                    Text(Calculations.formatDate(order.created_at))
                        .font(.system(size: 11))
                        .foregroundStyle(theme.textTertiary)
                    Spacer()
                    Text("\(order.items.count) prod.")
                        .font(.system(size: 11, weight: .semibold))
                        .foregroundStyle(theme.textSecondary)
                        .padding(.horizontal, 8)
                        .padding(.vertical, 3)
                        .background(theme.surfaceAlt)
                        .clipShape(.rect(cornerRadius: 6))
                }
                .padding(.top, 12)
                .overlay(
                    Rectangle().fill(theme.divider).frame(height: 1),
                    alignment: .top
                )
            }
            .padding(16)
            .frame(maxWidth: .infinity, minHeight: 188, alignment: .top)
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
            Button("Duplicar", systemImage: "doc.on.doc") {
                onDuplicate()
            }
        }
    }
}

// MARK: - Alert helper

extension UIApplication {
    func topVC() -> UIViewController? {
        guard let scene = connectedScenes.first as? UIWindowScene,
              let window = scene.windows.first,
              let rootVC = window.rootViewController else { return nil }
        var top = rootVC
        while let presented = top.presentedViewController {
            top = presented
        }
        return top
    }
}
