import SwiftUI

struct SearchView: View {
    @Environment(AppStore.self) private var store
    @State private var searchTerm = ""
    @State private var selectedOrderId: UUID?
    @State private var showOrderDetail = false

    private var theme: ThemeColors { themeColors(for: store.themeMode) }
    private var results: [Order] { store.searchOrders(searchTerm) }

    var body: some View {
        VStack(spacing: 0) {
            // Search bar
            HStack(spacing: 12) {
                Image(systemName: "magnifyingglass")
                    .font(.system(size: 18))
                    .foregroundStyle(theme.textTertiary)

                TextField("", text: $searchTerm, prompt: Text("Buscar por nombre, dirección, NIF...").foregroundColor(theme.textTertiary))
                    .font(.system(size: 15))
                    .foregroundStyle(theme.text)
                    .textInputAutocapitalization(.none)
                    .autocorrectionDisabled()

                if !searchTerm.isEmpty {
                    Button {
                        searchTerm = ""
                    } label: {
                        Image(systemName: "xmark.circle.fill")
                            .font(.system(size: 18))
                            .foregroundStyle(theme.textSecondary)
                    }
                    .buttonStyle(.plain)
                }
            }
            .padding(.horizontal, 16)
            .padding(.vertical, 13)
            .background(theme.surface)
            .overlay(
                .rect(cornerRadius: 16)
                    .stroke(theme.border, lineWidth: 1)
            )
            .clipShape(.rect(cornerRadius: 16))
            .shadow(color: theme.cardShadow, radius: 6, y: 2)
            .padding(.horizontal, 20)
            .padding(.top, 14)
            .padding(.bottom, 10)

            // Content
            if searchTerm.isEmpty {
                Spacer()
                VStack(spacing: 18) {
                    Image(systemName: "magnifyingglass")
                        .font(.system(size: 34, weight: .medium))
                        .foregroundStyle(theme.textTertiary)
                        .frame(width: 80, height: 80)
                        .background(theme.surfaceAlt)
                        .clipShape(.rect(cornerRadius: 22))

                    Text("Buscar Pedidos")
                        .font(.system(size: 19, weight: .bold, design: .rounded))
                        .foregroundStyle(theme.text)

                    Text("Busca por empresa, contacto, dirección, producto, NIF, teléfono, referencia...")
                        .font(.system(size: 14))
                        .foregroundStyle(theme.textSecondary)
                        .multilineTextAlignment(.center)
                        .lineSpacing(4)
                }
                .padding(.horizontal, 40)
                Spacer()
            } else if results.isEmpty {
                Spacer()
                VStack(spacing: 18) {
                    Image(systemName: "doc.text")
                        .font(.system(size: 34, weight: .medium))
                        .foregroundStyle(theme.textTertiary)
                        .frame(width: 80, height: 80)
                        .background(theme.surfaceAlt)
                        .clipShape(.rect(cornerRadius: 22))

                    Text("Sin resultados")
                        .font(.system(size: 19, weight: .bold, design: .rounded))
                        .foregroundStyle(theme.text)

                    Text("No se encontraron pedidos para \"\(searchTerm)\"")
                        .font(.system(size: 14))
                        .foregroundStyle(theme.textSecondary)
                        .multilineTextAlignment(.center)
                }
                .padding(.horizontal, 40)
                Spacer()
            } else {
                Text("\(results.count) resultado\(results.count != 1 ? "s" : "")")
                    .font(.system(size: 13, weight: .semibold))
                    .foregroundStyle(theme.textSecondary)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding(.horizontal, 20)
                    .padding(.vertical, 8)

                ScrollView {
                    LazyVStack(spacing: 12) {
                        ForEach(results) { order in
                            SearchResultCard(
                                order: order,
                                searchTerm: searchTerm,
                                theme: theme,
                                onTap: {
                                    selectedOrderId = order.id
                                    showOrderDetail = true
                                }
                            )
                        }
                    }
                    .padding(.horizontal, 20)
                    .padding(.bottom, 40)
                }
            }
        }
        .background(theme.background.ignoresSafeArea())
        .sheet(isPresented: $showOrderDetail) {
            if let id = selectedOrderId {
                NavigationStack {
                    OrderDetailView(orderId: id)
                }
            }
        }
        .navigationTitle("Buscar")
        .navigationBarTitleDisplayMode(.inline)
    }
}

struct SearchResultCard: View {
    let order: Order
    let searchTerm: String
    let theme: ThemeColors
    var onTap: () -> Void
    @State private var isPressed = false

    private var matched: (field: String, value: String)? {
        // Access store via environment is not available here; use simple matching
        let t = searchTerm.lowercased()
        let c = order.customer
        if order.reference_number.lowercased().contains(t) { return ("Referencia", order.reference_number) }
        if !order.custom_reference.isEmpty && order.custom_reference.lowercased().contains(t) { return ("Ref. Manual", order.custom_reference) }
        if c.nombre_empresa.lowercased().contains(t) { return ("Empresa", c.nombre_empresa) }
        if c.contacto.lowercased().contains(t) { return ("Contacto", c.contacto) }
        if c.direccion_1.lowercased().contains(t) { return ("Dirección", c.direccion_1) }
        if c.provincia.lowercased().contains(t) { return ("Provincia", c.provincia) }
        if c.email.lowercased().contains(t) { return ("Email", c.email) }
        if c.telefono_1.lowercased().contains(t) { return ("Teléfono", c.telefono_1) }
        if c.nif.lowercased().contains(t) { return ("NIF", c.nif) }
        if c.numero_factura.lowercased().contains(t) { return ("Nº Factura", c.numero_factura) }
        if order.manufacturer_name.lowercased().contains(t) { return ("Fabricante", order.manufacturer_name) }
        if let item = order.items.first(where: { $0.product_name.lowercased().contains(t) }) { return ("Producto", item.product_name) }
        if let ship = order.shipping_items.first(where: { $0.description.lowercased().contains(t) }) { return ("Envío", ship.description) }
        return nil
    }

    var body: some View {
        Button(action: onTap) {
            HStack(alignment: .top, spacing: 12) {
                VStack(alignment: .leading, spacing: 0) {
                    Text(order.reference_number)
                        .font(.system(size: 14, weight: .heavy, design: .monospaced))
                        .foregroundStyle(theme.text)
                        .lineLimit(1)

                    Text(order.customer.nombre_empresa)
                        .font(.system(size: 14, weight: .semibold))
                        .foregroundStyle(theme.textSecondary)
                        .lineLimit(1)
                        .padding(.top, 3)

                    HStack(spacing: 6) {
                        Text(order.manufacturer_name)
                            .font(.system(size: 12))
                            .foregroundStyle(theme.textTertiary)
                        Circle()
                            .fill(theme.textTertiary)
                            .frame(width: 3, height: 3)
                        Text("\(order.year)")
                            .font(.system(size: 12))
                            .foregroundStyle(theme.textTertiary)
                    }
                    .padding(.top, 5)

                    if let m = matched {
                        HStack(spacing: 5) {
                            Text("\(m.field):")
                                .font(.system(size: 11, weight: .semibold))
                                .foregroundStyle(theme.primary)
                            Text(m.value)
                                .font(.system(size: 11))
                                .foregroundStyle(theme.text)
                                .lineLimit(1)
                        }
                        .padding(.horizontal, 10)
                        .padding(.vertical, 4)
                        .background(theme.primarySoft)
                        .clipShape(.rect(cornerRadius: 8))
                        .padding(.top, 8)
                    }
                }

                Spacer()

                VStack(alignment: .trailing, spacing: 8) {
                    Text(Calculations.formatCurrency(order.total_with_vat))
                        .font(.system(size: 16, weight: .heavy))
                        .foregroundStyle(theme.text)
                    StatusBadge(status: order.status, size: .small, theme: theme)
                }
            }
            .padding(16)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(theme.surfaceElevated)
            .clipShape(.rect(cornerRadius: 18))
            .overlay(
                .rect(cornerRadius: 18)
                    .stroke(theme.borderLight, lineWidth: 1)
            )
            .shadow(color: theme.cardShadow, radius: 6, y: 2)
            .scaleEffect(isPressed ? 0.96 : 1.0)
            .animation(.spring(response: 0.3, dampingFraction: 0.7), value: isPressed)
        }
        .buttonStyle(.plain)
        .simultaneousGesture(
            DragGesture(minimumDistance: 0)
                .onChanged { _ in isPressed = true }
                .onEnded { _ in isPressed = false }
        )
    }
}
