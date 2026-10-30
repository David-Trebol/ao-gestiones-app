import SwiftUI

struct OrderDetailView: View {
    @Environment(AppStore.self) private var store
    @Environment(\.dismiss) private var dismiss
    let orderId: UUID

    @State private var isEditingRef = false
    @State private var editRefValue = ""
    @State private var expandedItems: Set<Int> = []
    @State private var showEditForm = false

    private var theme: ThemeColors { themeColors(for: store.themeMode) }
    private var isDark: Bool { store.themeMode == .dark }

    private var order: Order? {
        store.orders.first(where: { $0.id == orderId })
    }

    var body: some View {
        Group {
            if let order {
                ScrollView {
                    VStack(spacing: 16) {
                        heroCard(order)
                        customerCard(order)
                        totalsCard(order)
                        if !order.shipping_items.isEmpty {
                            shippingCard(order)
                        }
                        metaRow(order)
                        productsCard(order)
                        additionalCard(order)
                    }
                    .padding(.horizontal, 20)
                    .padding(.top, 6)
                    .padding(.bottom, 40)
                }
                .background(theme.background.ignoresSafeArea())
                .scrollIndicators(.hidden)
                .navigationTitle(order.reference_number)
                .navigationBarTitleDisplayMode(.inline)
                .toolbar {
                    ToolbarItem(placement: .topBarTrailing) {
                        HStack(spacing: 16) {
                            Button { handleDuplicate(order) } label: {
                                Image(systemName: "doc.on.doc")
                                    .font(.system(size: 18))
                                    .foregroundStyle(.white)
                            }
                            Button { showEditForm = true } label: {
                                Image(systemName: "pencil")
                                    .font(.system(size: 18))
                                    .foregroundStyle(.white)
                            }
                            Button { handleDelete(order) } label: {
                                Image(systemName: "trash")
                                    .font(.system(size: 18))
                                    .foregroundStyle(Color(red: 0xFF/255, green: 0xB4/255, blue: 0xB4/255))
                            }
                        }
                    }
                }
                .sheet(isPresented: $showEditForm) {
                    NavigationStack {
                        OrderFormView(editOrderId: order.id, presetManufacturerId: nil, presetYear: nil)
                    }
                }
            } else {
                Text("Pedido no encontrado")
                    .font(.system(size: 16))
                    .foregroundStyle(theme.textSecondary)
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
                    .background(theme.background.ignoresSafeArea())
            }
        }
    }

    // MARK: - Hero card

    private func heroCard(_ order: Order) -> some View {
        VStack(spacing: 0) {
            HStack(alignment: .top) {
                VStack(alignment: .leading, spacing: 6) {
                    HStack(spacing: 4) {
                        Image(systemName: "number")
                            .font(.system(size: 12))
                            .foregroundStyle(theme.primaryLight)
                        Text("REFERENCIA")
                            .font(.system(size: 10, weight: .bold))
                            .tracking(1)
                            .foregroundStyle(theme.primaryLight)
                    }
                    Text(order.reference_number)
                        .font(.system(size: 20, weight: .heavy, design: .monospaced))
                        .foregroundStyle(theme.text)
                        .lineLimit(1)
                        .minimumScaleFactor(0.7)
                }
                Spacer()
                StatusBadge(status: order.status, theme: theme)
            }

            Rectangle().fill(theme.divider).frame(height: 1)
                .padding(.vertical, 16)

            // Custom ref
            VStack(alignment: .leading, spacing: 6) {
                HStack(spacing: 4) {
                    Image(systemName: "tag")
                        .font(.system(size: 12))
                        .foregroundStyle(isEditingRef ? theme.accent : theme.textSecondary)
                    Text("REF. MANUAL")
                        .font(.system(size: 10, weight: .bold))
                        .tracking(1)
                        .foregroundStyle(isEditingRef ? theme.accent : theme.textSecondary)
                }

                if isEditingRef {
                    HStack(spacing: 8) {
                        TextField("", text: $editRefValue, prompt: Text("Escribe la referencia...").foregroundColor(theme.textTertiary))
                            .font(.system(size: 15, weight: .semibold))
                            .foregroundStyle(theme.text)
                            .padding(.horizontal, 14)
                            .padding(.vertical, 10)
                            .background(theme.background)
                            .overlay(
                                .rect(cornerRadius: 12)
                                    .stroke(theme.accent, lineWidth: 2)
                            )
                            .clipShape(.rect(cornerRadius: 12))

                        Button { saveRef(order) } label: {
                            Image(systemName: "checkmark")
                                .font(.system(size: 16, weight: .bold))
                                .foregroundStyle(theme.success)
                                .frame(width: 36, height: 36)
                                .background(theme.surfaceAlt)
                                .clipShape(.rect(cornerRadius: 10))
                        }
                        .buttonStyle(.plain)

                        Button { cancelEditRef() } label: {
                            Image(systemName: "xmark")
                                .font(.system(size: 16, weight: .bold))
                                .foregroundStyle(theme.error)
                                .frame(width: 36, height: 36)
                                .background(theme.surfaceAlt)
                                .clipShape(.rect(cornerRadius: 10))
                        }
                        .buttonStyle(.plain)
                    }
                } else {
                    Button {
                        editRefValue = order.custom_reference
                        isEditingRef = true
                    } label: {
                        HStack {
                            Text(order.custom_reference.isEmpty ? "Sin referencia manual" : order.custom_reference)
                                .font(.system(size: 15, weight: .semibold))
                                .foregroundStyle(theme.text)
                            Spacer()
                            Image(systemName: "pencil")
                                .font(.system(size: 12))
                                .foregroundStyle(theme.primary)
                                .frame(width: 28, height: 28)
                                .background(theme.primarySoft)
                                .clipShape(.rect(cornerRadius: 8))
                        }
                        .padding(.horizontal, 14)
                        .padding(.vertical, 10)
                        .background(theme.surfaceAlt)
                        .overlay(
                            .rect(cornerRadius: 12)
                                .stroke(theme.borderLight, lineWidth: 1)
                        )
                        .clipShape(.rect(cornerRadius: 12))
                    }
                    .buttonStyle(.plain)
                }
            }
        }
        .padding(20)
        .background(theme.surface)
        .clipShape(.rect(cornerRadius: 20))
        .overlay(
            .rect(cornerRadius: 20)
                .stroke(theme.borderLight, lineWidth: 1)
        )
        .shadow(color: theme.cardShadow, radius: 12, y: 4)
    }

    // MARK: - Customer card

    private func customerCard(_ order: Order) -> some View {
        VStack(alignment: .leading, spacing: 0) {
            sectionHeader(icon: "building.2", title: "Cliente", theme: theme)

            VStack(spacing: 16) {
                customerField("Empresa", order.customer.nombre_empresa)
                if !order.customer.contacto.isEmpty {
                    customerFieldWithSub("Contacto", order.customer.contacto,
                                         sub: order.customer.departamento.isEmpty ? nil : order.customer.departamento)
                }
                if !order.customer.numero_referencia_pedido.isEmpty {
                    customerField("Ref. Pedido Cliente", order.customer.numero_referencia_pedido)
                }

                // Address
                HStack(alignment: .top, spacing: 12) {
                    Image(systemName: "mappin.and.ellipse")
                        .font(.system(size: 14))
                        .foregroundStyle(theme.primary)
                        .frame(width: 32, height: 32)
                        .background(theme.primarySoft)
                        .clipShape(.rect(cornerRadius: 10))

                    VStack(alignment: .leading, spacing: 2) {
                        Text("Dirección")
                            .font(.system(size: 10, weight: .semibold))
                            .tracking(0.5)
                            .textCase(.uppercase)
                            .foregroundStyle(theme.textSecondary)
                        Text(order.customer.direccion_1)
                            .font(.system(size: 14, weight: .semibold))
                            .foregroundStyle(theme.text)
                        if !order.customer.direccion_2.isEmpty {
                            Text(order.customer.direccion_2)
                                .font(.system(size: 13))
                                .foregroundStyle(theme.textSecondary)
                        }
                        Text("\(order.customer.codigo_postal) \(order.customer.provincia)")
                            .font(.system(size: 13))
                            .foregroundStyle(theme.textSecondary)
                        Text(order.customer.pais)
                            .font(.system(size: 13))
                            .foregroundStyle(theme.textSecondary)
                    }
                }

                // Contact row
                HStack(spacing: 10) {
                    HStack(spacing: 8) {
                        Image(systemName: "phone")
                            .font(.system(size: 12))
                            .foregroundStyle(theme.primary)
                            .frame(width: 26, height: 26)
                            .background(theme.primarySoft)
                            .clipShape(.rect(cornerRadius: 8))
                        VStack(alignment: .leading, spacing: 0) {
                            Text("Teléfonos")
                                .font(.system(size: 10, weight: .semibold))
                                .tracking(0.5)
                                .textCase(.uppercase)
                                .foregroundStyle(theme.textSecondary)
                            Text(order.customer.telefono_1)
                                .font(.system(size: 14, weight: .semibold))
                                .foregroundStyle(theme.text)
                            if !order.customer.telefono_2.isEmpty {
                                Text(order.customer.telefono_2)
                                    .font(.system(size: 13))
                                    .foregroundStyle(theme.textSecondary)
                            }
                        }
                    }
                    Spacer()
                    HStack(spacing: 8) {
                        Image(systemName: "envelope")
                            .font(.system(size: 12))
                            .foregroundStyle(theme.primary)
                            .frame(width: 26, height: 26)
                            .background(theme.primarySoft)
                            .clipShape(.rect(cornerRadius: 8))
                        VStack(alignment: .leading, spacing: 0) {
                            Text("Email")
                                .font(.system(size: 10, weight: .semibold))
                                .tracking(0.5)
                                .textCase(.uppercase)
                                .foregroundStyle(theme.textSecondary)
                            Text(order.customer.email)
                                .font(.system(size: 14, weight: .semibold))
                                .foregroundStyle(theme.text)
                                .lineLimit(1)
                        }
                    }
                    Spacer()
                }

                customerField("NIF", order.customer.nif, isLast: true)
            }
        }
        .padding(20)
        .background(theme.surface)
        .clipShape(.rect(cornerRadius: 20))
        .overlay(
            .rect(cornerRadius: 20)
                .stroke(theme.borderLight, lineWidth: 1)
        )
        .shadow(color: theme.cardShadow, radius: 8, y: 2)
    }

    private func customerField(_ label: String, _ value: String, isLast: Bool = false) -> some View {
        VStack(alignment: .leading, spacing: 3) {
            Text(label.uppercased())
                .font(.system(size: 10, weight: .semibold))
                .tracking(0.5)
                .foregroundStyle(theme.textSecondary)
            Text(value)
                .font(.system(size: 14, weight: .semibold))
                .foregroundStyle(theme.text)
        }
        .padding(.bottom, isLast ? 0 : 12)
        .overlay(
            Group {
                if !isLast {
                    Rectangle().fill(theme.divider).frame(height: 1).padding(.top, 12 + 3 + 14)
                }
            }
        )
    }

    private func customerFieldWithSub(_ label: String, _ value: String, sub: String?) -> some View {
        VStack(alignment: .leading, spacing: 3) {
            Text(label.uppercased())
                .font(.system(size: 10, weight: .semibold))
                .tracking(0.5)
                .foregroundStyle(theme.textSecondary)
            Text(value)
                .font(.system(size: 14, weight: .semibold))
                .foregroundStyle(theme.text)
            if let sub {
                Text(sub)
                    .font(.system(size: 13))
                    .foregroundStyle(theme.textSecondary)
            }
        }
        .padding(.bottom, 12)
        .overlay(
            Rectangle().fill(theme.divider).frame(height: 1).padding(.top, 60),
            alignment: .top
        )
    }

    // MARK: - Totals card

    private func totalsCard(_ order: Order) -> some View {
        VStack(spacing: 0) {
            HStack(spacing: 10) {
                Image(systemName: "eurosign")
                    .font(.system(size: 16, weight: .semibold))
                    .foregroundStyle(.white)
                    .frame(width: 32, height: 32)
                    .background(Color.white.opacity(0.12))
                    .clipShape(.rect(cornerRadius: 10))
                Text("Resumen Financiero")
                    .font(.system(size: 16, weight: .bold))
                    .foregroundStyle(.white)
                Spacer()
            }
            .padding(.bottom, 18)

            HStack {
                VStack(spacing: 6) {
                    Text("Subtotal")
                        .font(.system(size: 11, weight: .semibold))
                        .foregroundStyle(Color.white.opacity(0.5))
                    Text(Calculations.formatCurrency(order.total_ex_vat))
                        .font(.system(size: 17, weight: .heavy))
                        .foregroundStyle(.white)
                    Text("sin IVA")
                        .font(.system(size: 9))
                        .textCase(.uppercase)
                        .foregroundStyle(Color.white.opacity(0.35))
                }
                .frame(maxWidth: .infinity)

                Rectangle().fill(Color.white.opacity(0.1)).frame(width: 1, height: 40)

                VStack(spacing: 6) {
                    Text("IVA")
                        .font(.system(size: 11, weight: .semibold))
                        .foregroundStyle(Color.white.opacity(0.5))
                    Text(Calculations.formatCurrency(order.total_vat))
                        .font(.system(size: 17, weight: .heavy))
                        .foregroundStyle(.white)
                    Text("impuestos")
                        .font(.system(size: 9))
                        .textCase(.uppercase)
                        .foregroundStyle(Color.white.opacity(0.35))
                }
                .frame(maxWidth: .infinity)
            }

            HStack {
                Text("TOTAL")
                    .font(.system(size: 13, weight: .bold))
                    .tracking(1.5)
                    .foregroundStyle(Color.white.opacity(0.6))
                Spacer()
                Text(Calculations.formatCurrency(order.total_with_vat))
                    .font(.system(size: 26, weight: .heavy, design: .rounded))
                    .foregroundStyle(.white)
            }
            .padding(.horizontal, 18)
            .padding(.vertical, 14)
            .background(Color.white.opacity(0.1))
            .clipShape(.rect(cornerRadius: 14))
            .padding(.top, 16)
        }
        .padding(20)
        .background(isDark ? theme.surface : theme.primaryDark)
        .clipShape(.rect(cornerRadius: 20))
        .overlay(
            Group {
                if isDark {
                    .rect(cornerRadius: 20).stroke(theme.border, lineWidth: 1)
                }
            }
        )
    }

    // MARK: - Shipping card

    private func shippingCard(_ order: Order) -> some View {
        VStack(alignment: .leading, spacing: 0) {
            HStack(spacing: 10) {
                Image(systemName: "truck.box")
                    .font(.system(size: 16))
                    .foregroundStyle(theme.warning)
                    .frame(width: 32, height: 32)
                    .background(theme.warningBg)
                    .clipShape(.rect(cornerRadius: 10))
                Text("Gastos de Envío")
                    .font(.system(size: 17, weight: .bold))
                    .foregroundStyle(theme.text)
                Spacer()
                Text("\(order.shipping_items.count)")
                    .font(.system(size: 12, weight: .bold))
                    .foregroundStyle(theme.warning)
                    .padding(.horizontal, 8)
                    .padding(.vertical, 3)
                    .background(theme.warningBg)
                    .clipShape(.rect(cornerRadius: 8))
            }
            .padding(.bottom, 16)

            ForEach(Array(order.shipping_items.enumerated()), id: \.element.id) { idx, ship in
                VStack(alignment: .leading, spacing: 0) {
                    HStack {
                        HStack(spacing: 10) {
                            Text("\(idx + 1)")
                                .font(.system(size: 11, weight: .bold))
                                .foregroundStyle(theme.warning)
                                .frame(width: 26, height: 26)
                                .background(theme.warningBg)
                                .clipShape(.rect(cornerRadius: 8))
                            VStack(alignment: .leading, spacing: 2) {
                                Text(ship.description.isEmpty ? "Envío" : ship.description)
                                    .font(.system(size: 14, weight: .bold))
                                    .foregroundStyle(theme.text)
                                Text("× \(ship.quantity) uds.")
                                    .font(.system(size: 12))
                                    .foregroundStyle(theme.textSecondary)
                            }
                        }
                        Spacer()
                        VStack(alignment: .trailing, spacing: 1) {
                            Text(Calculations.formatCurrency(ship.valor_con_iva))
                                .font(.system(size: 16, weight: .heavy))
                                .foregroundStyle(theme.text)
                            Text("con IVA")
                                .font(.system(size: 10))
                                .foregroundStyle(theme.textTertiary)
                        }
                    }

                    HStack(spacing: 0) {
                        gridItem("Costo", Calculations.formatCurrency(ship.costo_unitario), theme.text)
                        gridItem("Total s/IVA", Calculations.formatCurrency(ship.valor_sin_iva), theme.warning)
                        gridItem("IVA", "\(Int(ship.vat_percentage))%", theme.text)
                    }
                    .padding(.top, 12)
                    .overlay(
                        Rectangle().fill(theme.borderLight).frame(height: 1),
                        alignment: .top
                    )
                }
                .padding(16)
                .background(isDark ? theme.surfaceAlt : Color(red: 0xFF/255, green: 0xFD/255, blue: 0xF7/255))
                .clipShape(.rect(cornerRadius: 16))
                .overlay(
                    .rect(cornerRadius: 16)
                        .stroke(isDark ? theme.border : theme.warning.opacity(0.3), lineWidth: 1)
                )
                .padding(.bottom, idx < order.shipping_items.count - 1 ? 12 : 0)
            }
        }
        .padding(20)
        .background(theme.surface)
        .clipShape(.rect(cornerRadius: 20))
        .overlay(
            .rect(cornerRadius: 20)
                .stroke(theme.borderLight, lineWidth: 1)
        )
        .shadow(color: theme.cardShadow, radius: 8, y: 2)
    }

    // MARK: - Meta row

    private func metaRow(_ order: Order) -> some View {
        VStack(spacing: 12) {
            HStack(spacing: 12) {
                metaItem(icon: "building.2", label: "Fabricante", value: order.manufacturer_name, sub: order.manufacturer_code)
                metaItem(icon: "calendar", label: "Año", value: "\(order.year)", sub: nil)
            }
            HStack(spacing: 12) {
                metaItem(icon: "clock", label: "Creado", value: Calculations.formatDateLong(order.created_at), sub: nil)
                metaItem(icon: "clock", label: "Actualizado", value: Calculations.formatDateLong(order.updated_at), sub: nil)
            }
        }
    }

    private func metaItem(icon: String, label: String, value: String, sub: String?) -> some View {
        HStack(spacing: 10) {
            Image(systemName: icon)
                .font(.system(size: 14))
                .foregroundStyle(theme.primary)
                .frame(width: 32, height: 32)
                .background(theme.primarySoft)
                .clipShape(.rect(cornerRadius: 10))
            VStack(alignment: .leading, spacing: 2) {
                Text(label.uppercased())
                    .font(.system(size: 10, weight: .semibold))
                    .tracking(0.5)
                    .foregroundStyle(theme.textSecondary)
                Text(value)
                    .font(.system(size: 14, weight: .bold))
                    .foregroundStyle(theme.text)
                if let sub {
                    Text(sub)
                        .font(.system(size: 10, design: .monospaced))
                        .foregroundStyle(theme.textTertiary)
                }
            }
            Spacer()
        }
        .padding(16)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(theme.surface)
        .clipShape(.rect(cornerRadius: 16))
        .overlay(
            .rect(cornerRadius: 16)
                .stroke(theme.borderLight, lineWidth: 1)
        )
    }

    // MARK: - Products card

    private func productsCard(_ order: Order) -> some View {
        VStack(alignment: .leading, spacing: 0) {
            HStack(spacing: 10) {
                Image(systemName: "shippingbox")
                    .font(.system(size: 16))
                    .foregroundStyle(theme.primary)
                    .frame(width: 32, height: 32)
                    .background(theme.primarySoft)
                    .clipShape(.rect(cornerRadius: 10))
                Text("Productos")
                    .font(.system(size: 17, weight: .bold))
                    .foregroundStyle(theme.text)
                Spacer()
                Text("\(order.items.count)")
                    .font(.system(size: 12, weight: .bold))
                    .foregroundStyle(theme.primary)
                    .padding(.horizontal, 8)
                    .padding(.vertical, 3)
                    .background(theme.primarySoft)
                    .clipShape(.rect(cornerRadius: 8))
            }
            .padding(.bottom, 16)

            ForEach(Array(order.items.enumerated()), id: \.element.id) { idx, item in
                VStack(alignment: .leading, spacing: 0) {
                    HStack {
                        HStack(spacing: 10) {
                            Text("\(idx + 1)")
                                .font(.system(size: 11, weight: .bold))
                                .foregroundStyle(theme.primary)
                                .frame(width: 26, height: 26)
                                .background(theme.primarySoft)
                                .clipShape(.rect(cornerRadius: 8))
                            VStack(alignment: .leading, spacing: 2) {
                                Text(item.product_name)
                                    .font(.system(size: 14, weight: .bold))
                                    .foregroundStyle(theme.text)
                                    .lineLimit(2)
                                Text("× \(item.quantity) uds.")
                                    .font(.system(size: 12))
                                    .foregroundStyle(theme.textSecondary)
                            }
                        }
                        Spacer()
                        VStack(alignment: .trailing, spacing: 1) {
                            Text(Calculations.formatCurrency(item.valor_con_iva))
                                .font(.system(size: 16, weight: .heavy))
                                .foregroundStyle(theme.text)
                            Text("con IVA")
                                .font(.system(size: 10))
                                .foregroundStyle(theme.textTertiary)
                        }
                    }

                    // Description toggle
                    Button {
                        if expandedItems.contains(idx) { expandedItems.remove(idx) }
                        else { expandedItems.insert(idx) }
                    } label: {
                        HStack(spacing: 6) {
                            Image(systemName: "doc.text")
                                .font(.system(size: 13))
                                .foregroundStyle(theme.textSecondary)
                            Text(expandedItems.contains(idx) ? "Ocultar descripción" : "Ver descripción")
                                .font(.system(size: 12, weight: .semibold))
                                .foregroundStyle(theme.textSecondary)
                            Spacer()
                            Image(systemName: expandedItems.contains(idx) ? "chevron.up" : "chevron.down")
                                .font(.system(size: 14))
                                .foregroundStyle(theme.textSecondary)
                        }
                        .padding(.horizontal, 12)
                        .padding(.vertical, 8)
                        .background(theme.primarySoft.opacity(0.4))
                        .overlay(
                            .rect(cornerRadius: 10)
                                .stroke(theme.borderLight, lineWidth: 1)
                        )
                        .clipShape(.rect(cornerRadius: 10))
                    }
                    .buttonStyle(.plain)
                    .padding(.top, 12)

                    if expandedItems.contains(idx) {
                        Text(item.product_name)
                            .font(.system(size: 13))
                            .foregroundStyle(theme.textSecondary)
                            .padding(12)
                            .frame(maxWidth: .infinity, alignment: .leading)
                            .background(theme.surface)
                            .overlay(
                                .rect(cornerRadius: 10)
                                    .stroke(theme.borderLight, lineWidth: 1)
                            )
                            .clipShape(.rect(cornerRadius: 10))
                            .padding(.top, 8)
                    }

                    // Grid
                    HStack(spacing: 0) {
                        gridItem("Costo Unit.", Calculations.formatCurrency(item.costo_unitario), theme.text)
                        gridItem("Descuento", "\(Int(item.descuento_porcentaje))%", theme.text)
                        if item.total_sin_iva > 0 {
                            gridItem("Total s/IVA", Calculations.formatCurrency(item.total_sin_iva), theme.primary)
                        } else {
                            gridItem("PVP Neto", Calculations.formatCurrency(item.pvp_neto_sin_iva), theme.text)
                        }
                        gridItem("IVA", "\(Int(item.vat_percentage))%", theme.text)
                        gridItem("Beneficio", Calculations.formatCurrency(item.beneficio_bruto),
                                 item.beneficio_bruto >= 0 ? theme.success : theme.error)
                    }
                    .padding(.top, 12)
                    .overlay(
                        Rectangle().fill(theme.borderLight).frame(height: 1),
                        alignment: .top
                    )
                }
                .padding(16)
                .background(theme.surfaceAlt)
                .clipShape(.rect(cornerRadius: 16))
                .overlay(
                    .rect(cornerRadius: 16)
                        .stroke(theme.borderLight, lineWidth: 1)
                )
                .padding(.bottom, idx < order.items.count - 1 ? 12 : 0)
            }
        }
        .padding(20)
        .background(theme.surface)
        .clipShape(.rect(cornerRadius: 20))
        .overlay(
            .rect(cornerRadius: 20)
                .stroke(theme.borderLight, lineWidth: 1)
        )
        .shadow(color: theme.cardShadow, radius: 8, y: 2)
    }

    // MARK: - Additional card

    @ViewBuilder
    private func additionalCard(_ order: Order) -> some View {
        let c = order.customer
        let hasInfo = !c.oferta_proforma.isEmpty || !c.condiciones_entrega.isEmpty ||
                      !c.condiciones_pago.isEmpty || !c.numero_factura.isEmpty || !c.numero_recibo.isEmpty

        if hasInfo {
            VStack(alignment: .leading, spacing: 0) {
                sectionHeader(icon: "doc.text", title: "Info. Adicional", theme: theme)

                if !c.oferta_proforma.isEmpty || !c.numero_factura.isEmpty || !c.numero_recibo.isEmpty {
                    HStack(spacing: 12) {
                        if !c.oferta_proforma.isEmpty {
                            additionalItem("Oferta/Proforma", c.oferta_proforma)
                        }
                        if !c.numero_factura.isEmpty {
                            additionalItem("Nº Factura", c.numero_factura)
                        }
                        if !c.numero_recibo.isEmpty {
                            additionalItem("Nº Recibo", c.numero_recibo)
                        }
                    }
                    .padding(.bottom, 12)
                }

                if !c.condiciones_entrega.isEmpty {
                    VStack(alignment: .leading, spacing: 3) {
                        Text("Condiciones de Entrega")
                            .font(.system(size: 10, weight: .semibold))
                            .tracking(0.5)
                            .textCase(.uppercase)
                            .foregroundStyle(theme.textSecondary)
                        Text(c.condiciones_entrega)
                            .font(.system(size: 13))
                            .foregroundStyle(theme.textSecondary)
                    }
                    .padding(.top, 12)
                    .overlay(Rectangle().fill(theme.divider).frame(height: 1), alignment: .top)
                }

                if !c.condiciones_pago.isEmpty {
                    VStack(alignment: .leading, spacing: 3) {
                        Text("Condiciones de Pago")
                            .font(.system(size: 10, weight: .semibold))
                            .tracking(0.5)
                            .textCase(.uppercase)
                            .foregroundStyle(theme.textSecondary)
                        Text(c.condiciones_pago)
                            .font(.system(size: 13))
                            .foregroundStyle(theme.textSecondary)
                    }
                    .padding(.top, 12)
                    .overlay(Rectangle().fill(theme.divider).frame(height: 1), alignment: .top)
                }
            }
            .padding(20)
            .background(theme.surface)
            .clipShape(.rect(cornerRadius: 20))
            .overlay(
                .rect(cornerRadius: 20)
                    .stroke(theme.borderLight, lineWidth: 1)
            )
            .shadow(color: theme.cardShadow, radius: 8, y: 2)
        }
    }

    private func additionalItem(_ label: String, _ value: String) -> some View {
        VStack(alignment: .leading, spacing: 3) {
            Text(label.uppercased())
                .font(.system(size: 10, weight: .semibold))
                .tracking(0.5)
                .foregroundStyle(theme.textSecondary)
            Text(value)
                .font(.system(size: 14, weight: .semibold))
                .foregroundStyle(theme.text)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(12)
        .background(theme.surfaceAlt)
        .clipShape(.rect(cornerRadius: 12))
    }

    // MARK: - Helpers

    private func sectionHeader(icon: String, title: String, theme: ThemeColors) -> some View {
        HStack(spacing: 10) {
            Image(systemName: icon)
                .font(.system(size: 16))
                .foregroundStyle(theme.primary)
                .frame(width: 32, height: 32)
                .background(theme.primarySoft)
                .clipShape(.rect(cornerRadius: 10))
            Text(title)
                .font(.system(size: 17, weight: .bold))
                .foregroundStyle(theme.text)
            Spacer()
        }
        .padding(.bottom, 16)
    }

    private func gridItem(_ label: String, _ value: String, _ color: Color) -> some View {
        VStack(alignment: .leading, spacing: 2) {
            Text(label)
                .font(.system(size: 10))
                .tracking(0.3)
                .foregroundStyle(theme.textTertiary)
            Text(value)
                .font(.system(size: 13, weight: .bold))
                .foregroundStyle(color)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(.vertical, 6)
        .padding(.horizontal, 4)
    }

    // MARK: - Actions

    private func saveRef(_ order: Order) {
        store.updateOrderField(order.id, field: "custom_reference", value: editRefValue.trimmingCharacters(in: .whitespaces))
        isEditingRef = false
    }

    private func cancelEditRef() {
        isEditingRef = false
        editRefValue = ""
    }

    private func handleDelete(_ order: Order) {
        let alert = UIAlertController(title: "¿Estás seguro?", message: "Se eliminará permanentemente el pedido \(order.reference_number).", preferredStyle: .alert)
        alert.addAction(UIAlertAction(title: "Cancelar", style: .cancel))
        alert.addAction(UIAlertAction(title: "Eliminar", style: .destructive) { _ in
            store.deleteOrder(order.id)
            dismiss()
        })
        UIApplication.shared.topVC()?.present(alert, animated: true)
    }

    private func handleDuplicate(_ order: Order) {
        let alert = UIAlertController(title: "Duplicar pedido", message: "¿Duplicar \"\(order.reference_number)\"?", preferredStyle: .alert)
        alert.addAction(UIAlertAction(title: "Cancelar", style: .cancel))
        alert.addAction(UIAlertAction(title: "Duplicar", style: .default) { _ in
            _ = store.duplicateOrder(order.id)
        })
        UIApplication.shared.topVC()?.present(alert, animated: true)
    }
}
