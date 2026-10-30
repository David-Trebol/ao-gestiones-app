import SwiftUI

struct OrderFormView: View {
    @Environment(AppStore.self) private var store
    @Environment(\.dismiss) private var dismiss

    let editOrderId: UUID?
    let presetManufacturerId: UUID?
    let presetYear: Int?

    @State private var customer = Customer()
    @State private var selectedManufacturerId: UUID?
    @State private var year: Int = Calendar.current.component(.year, from: Date())
    @State private var status: OrderStatus = .pending
    @State private var customReference = ""
    @State private var shippingCost: Double = 0
    @State private var items: [OrderFormItem] = [OrderFormItem()]
    @State private var shippingItems: [ShippingFormItem] = []

    private var theme: ThemeColors { themeColors(for: store.themeMode) }
    private var isDark: Bool { store.themeMode == .dark }

    private var editingOrder: Order? {
        guard let editOrderId else { return nil }
        return store.orders.first(where: { $0.id == editOrderId })
    }

    private var totals: (exVat: Double, vat: Double, shipping: Double, grand: Double) {
        let itemTotals = items.map { Calculations.calculateItemTotals(
            productName: $0.product_name, quantity: $0.quantity,
            costoUnitario: $0.costo_unitario, tpvUnitario: $0.tpv_unitario,
            totalSinIva: $0.total_sin_iva, descuento: $0.descuento_porcentaje, vat: $0.vat_percentage
        )}
        let shipTotals = shippingItems.map { Calculations.calculateShippingTotals(
            description: $0.description, quantity: $0.quantity,
            costoUnitario: $0.costo_unitario, totalSinIva: $0.total_sin_iva, vat: $0.vat_percentage
        )}
        let exVat = itemTotals.reduce(0) { $0 + $1.valor_sin_iva }
        let vat = itemTotals.reduce(0) { $0 + ($1.valor_con_iva - $1.valor_sin_iva) }
        let ship = shipTotals.reduce(0) { $0 + $1.valor_con_iva }
        return (exVat, vat, ship, exVat + vat + ship + shippingCost)
    }

    var body: some View {
        ScrollView {
            VStack(spacing: 16) {
                // Section 1: Customer
                formSection(number: 1, title: "Cliente") {
                    formField("Empresa", text: $customer.nombre_empresa)
                    HStack(spacing: 12) {
                        formField("Contacto", text: $customer.contacto)
                        formField("Departamento", text: $customer.departamento)
                    }
                    formField("Dirección 1", text: $customer.direccion_1)
                    formField("Dirección 2", text: $customer.direccion_2)
                    HStack(spacing: 12) {
                        formField("C. Postal", text: $customer.codigo_postal, keyboard: .numberPad)
                        formField("Provincia", text: $customer.provincia)
                    }
                    formField("País", text: $customer.pais)
                    HStack(spacing: 12) {
                        formField("Teléfono 1", text: $customer.telefono_1, keyboard: .phonePad)
                        formField("Teléfono 2", text: $customer.telefono_2, keyboard: .phonePad)
                    }
                    formField("Email", text: $customer.email, keyboard: .emailAddress)
                    HStack(spacing: 12) {
                        formField("NIF / CIF", text: $customer.nif)
                        formField("Ref. Pedido Cliente", text: $customer.numero_referencia_pedido)
                    }
                }

                // Section 2: Order details
                formSection(number: 2, title: "Detalles del Pedido") {
                    // Manufacturer chips
                    VStack(alignment: .leading, spacing: 7) {
                        Text("FABRICANTE *")
                            .font(.system(size: 11, weight: .semibold))
                            .tracking(0.5)
                            .foregroundStyle(theme.textSecondary)
                        ScrollView(.horizontal, showsIndicators: false) {
                            HStack(spacing: 8) {
                                ForEach(store.manufacturers) { mfr in
                                    Button {
                                        selectedManufacturerId = mfr.id
                                    } label: {
                                        Text("\(mfr.name) (\(mfr.code))")
                                            .font(.system(size: 13, weight: .semibold))
                                            .foregroundStyle(selectedManufacturerId == mfr.id ? .white : theme.text)
                                            .padding(.horizontal, 14)
                                            .padding(.vertical, 9)
                                            .background(selectedManufacturerId == mfr.id ? theme.primary : theme.surfaceAlt)
                                            .overlay(
                                                .rect(cornerRadius: 10)
                                                    .stroke(selectedManufacturerId == mfr.id ? theme.primary : theme.border, lineWidth: 1)
                                            )
                                            .clipShape(.rect(cornerRadius: 10))
                                    }
                                    .buttonStyle(.plain)
                                }
                            }
                        }
                    }

                    HStack(spacing: 12) {
                        formField("Año *", value: Binding(
                            get: { String(year) },
                            set: { year = Int($0) ?? 0 }
                        ), keyboard: .numberPad)
                        formField("Ref. Manual", text: $customReference, placeholder: "Ej: REF-001")
                    }

                    // Status chips
                    VStack(alignment: .leading, spacing: 7) {
                        Text("ESTADO *")
                            .font(.system(size: 11, weight: .semibold))
                            .tracking(0.5)
                            .foregroundStyle(theme.textSecondary)
                        ScrollView(.horizontal, showsIndicators: false) {
                            HStack(spacing: 8) {
                                ForEach(OrderStatus.allCases, id: \.self) { s in
                                    Button {
                                        status = s
                                    } label: {
                                        Text(s.label)
                                            .font(.system(size: 13, weight: .semibold))
                                            .foregroundStyle(status == s ? .white : theme.text)
                                            .padding(.horizontal, 14)
                                            .padding(.vertical, 9)
                                            .background(status == s ? theme.primary : theme.surfaceAlt)
                                            .overlay(
                                                .rect(cornerRadius: 10)
                                                    .stroke(status == s ? theme.primary : theme.border, lineWidth: 1)
                                            )
                                            .clipShape(.rect(cornerRadius: 10))
                                    }
                                    .buttonStyle(.plain)
                                }
                            }
                        }
                    }

                    HStack(spacing: 12) {
                        formField("Oferta / Proforma", text: $customer.oferta_proforma)
                        formField("Envío Extra (€)", value: Binding(
                            get: { String(shippingCost) },
                            set: { shippingCost = Double($0) ?? 0 }
                        ), keyboard: .decimalPad)
                    }

                    formField("Condiciones Entrega", text: $customer.condiciones_entrega, multiline: true)
                    formField("Condiciones Pago", text: $customer.condiciones_pago, multiline: true)

                    HStack(spacing: 12) {
                        formField("Nº Factura", text: $customer.numero_factura)
                        formField("Nº Recibo", text: $customer.numero_recibo)
                    }
                }

                // Section 3: Products
                formSection(icon: "shippingbox", title: "Productos", addLabel: "Añadir", onAdd: {
                    items.append(OrderFormItem())
                }) {
                    ForEach(Array(items.enumerated()), id: \.element.id) { idx, item in
                        itemCard(idx: idx, isShipping: false)
                    }
                }

                // Section 4: Shipping
                formSection(icon: "truck.box", iconColor: theme.warning, title: "Gastos de Envío", addLabel: "Añadir", onAdd: {
                    shippingItems.append(ShippingFormItem())
                }) {
                    if shippingItems.isEmpty {
                        Text("Sin gastos de envío adicionales")
                            .font(.system(size: 14))
                            .foregroundStyle(theme.textTertiary)
                            .padding(.vertical, 8)
                    }
                    ForEach(Array(shippingItems.enumerated()), id: \.element.id) { idx, item in
                        shippingCard(idx: idx)
                    }
                }

                // Totals
                totalsCard

                // Submit button
                Button {
                    handleSubmit()
                } label: {
                    Text(editingOrder != nil ? "Actualizar Pedido" : "Crear Pedido")
                        .font(.system(size: 16, weight: .bold))
                        .foregroundStyle(.white)
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 16)
                        .background(theme.accent)
                        .clipShape(.rect(cornerRadius: 14))
                        .shadow(color: theme.accent.opacity(0.3), radius: 8, y: 4)
                }
                .buttonStyle(.plain)
            }
            .padding(.horizontal, 20)
            .padding(.top, 6)
            .padding(.bottom, 40)
        }
        .background(theme.background.ignoresSafeArea())
        .scrollIndicators(.hidden)
        .navigationTitle(editingOrder != nil ? "Editar Pedido" : "Nuevo Pedido")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                Button {
                    handleSubmit()
                } label: {
                    Text("Guardar")
                        .font(.system(size: 14, weight: .bold))
                        .foregroundStyle(.white)
                        .padding(.horizontal, 14)
                        .padding(.vertical, 7)
                        .background(theme.accent)
                        .clipShape(.rect(cornerRadius: 10))
                }
            }
        }
        .onAppear {
            loadEditingData()
        }
    }

    // MARK: - Load editing data

    private func loadEditingData() {
        if let order = editingOrder {
            customer = order.customer
            selectedManufacturerId = store.manufacturers.first(where: { $0.id.uuidString == order.manufacturer_id })?.id
            year = order.year
            status = order.status
            customReference = order.custom_reference
            shippingCost = order.shipping_cost
            items = order.items.map { OrderFormItem(
                product_name: $0.product_name, quantity: $0.quantity,
                costo_unitario: $0.costo_unitario, tpv_unitario: $0.tpv_unitario,
                total_sin_iva: $0.total_sin_iva, descuento_porcentaje: $0.descuento_porcentaje,
                vat_percentage: $0.vat_percentage
            )}
            shippingItems = order.shipping_items.map { ShippingFormItem(
                description: $0.description, quantity: $0.quantity,
                costo_unitario: $0.costo_unitario, total_sin_iva: $0.total_sin_iva,
                vat_percentage: $0.vat_percentage
            )}
        } else if let presetManufacturerId {
            selectedManufacturerId = presetManufacturerId
        }
        if let presetYear {
            year = presetYear
        }
    }

    // MARK: - Form section

    private func formSection<Content: View>(
        number: Int? = nil,
        icon: String? = nil,
        iconColor: Color = .clear,
        title: String,
        addLabel: String? = nil,
        onAdd: (() -> Void)? = nil,
        @ViewBuilder content: () -> Content
    ) -> some View {
        VStack(alignment: .leading, spacing: 0) {
            HStack(spacing: 10) {
                if let number {
                    Text("\(number)")
                        .font(.system(size: 14, weight: .heavy))
                        .foregroundStyle(.white)
                        .frame(width: 28, height: 28)
                        .background(theme.primary)
                        .clipShape(.rect(cornerRadius: 8))
                } else if let icon {
                    Image(systemName: icon)
                        .font(.system(size: 16))
                        .foregroundStyle(iconColor == .clear ? theme.primary : iconColor)
                        .frame(width: 32, height: 32)
                        .background(iconColor == .clear ? theme.primarySoft : iconColor.opacity(0.12))
                        .clipShape(.rect(cornerRadius: 10))
                }
                Text(title)
                    .font(.system(size: 17, weight: .bold, design: .rounded))
                    .foregroundStyle(theme.text)
                Spacer()
                if let addLabel, let onAdd {
                    Button(action: onAdd) {
                        HStack(spacing: 5) {
                            Image(systemName: "plus")
                                .font(.system(size: 11, weight: .bold))
                            Text(addLabel)
                                .font(.system(size: 12, weight: .semibold))
                        }
                        .foregroundStyle(theme.primary)
                        .padding(.horizontal, 12)
                        .padding(.vertical, 7)
                        .background(theme.primarySoft)
                        .overlay(
                            .rect(cornerRadius: 8)
                                .stroke(theme.primarySoftAlt, lineWidth: 1)
                        )
                        .clipShape(.rect(cornerRadius: 8))
                    }
                    .buttonStyle(.plain)
                }
            }
            .padding(.bottom, 16)

            content()
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

    // MARK: - Form field

    private func formField(_ label: String, text: Binding<String>, placeholder: String? = nil, keyboard: UIKeyboardType = .default, multiline: Bool = false) -> some View {
        VStack(alignment: .leading, spacing: 5) {
            Text(label)
                .font(.system(size: 11, weight: .semibold))
                .foregroundStyle(theme.textSecondary)
            if multiline {
                TextField("", text: text, prompt: Text(placeholder ?? label).foregroundColor(theme.textTertiary), axis: .vertical)
                    .font(.system(size: 15))
                    .foregroundStyle(theme.text)
                    .lineLimit(3...6)
                    .padding(.horizontal, 16)
                    .padding(.vertical, 13)
                    .background(theme.background)
                    .overlay(
                        .rect(cornerRadius: 12)
                            .stroke(theme.border, lineWidth: 1)
                    )
                    .clipShape(.rect(cornerRadius: 12))
            } else {
                TextField("", text: text, prompt: Text(placeholder ?? label).foregroundColor(theme.textTertiary))
                    .font(.system(size: 15))
                    .foregroundStyle(theme.text)
                    .keyboardType(keyboard)
                    .textInputAutocapitalization(keyboard == .emailAddress ? .none : .sentences)
                    .padding(.horizontal, 16)
                    .padding(.vertical, 13)
                    .background(theme.background)
                    .overlay(
                        .rect(cornerRadius: 12)
                            .stroke(theme.border, lineWidth: 1)
                    )
                    .clipShape(.rect(cornerRadius: 12))
            }
        }
        .padding(.bottom, 12)
    }

    private func formField(_ label: String, value: Binding<String>, placeholder: String? = nil, keyboard: UIKeyboardType = .default) -> some View {
        formField(label, text: value, placeholder: placeholder, keyboard: keyboard)
    }

    // MARK: - Item card

    private func itemCard(idx: Int, isShipping: Bool) -> some View {
        let item = $items[idx]
        let calc = Calculations.calculateItemTotals(
            productName: item.wrappedValue.product_name, quantity: item.wrappedValue.quantity,
            costoUnitario: item.wrappedValue.costo_unitario, tpvUnitario: item.wrappedValue.tpv_unitario,
            totalSinIva: item.wrappedValue.total_sin_iva, descuento: item.wrappedValue.descuento_porcentaje,
            vat: item.wrappedValue.vat_percentage
        )

        return VStack(alignment: .leading, spacing: 0) {
            HStack {
                Text("#\(idx + 1)")
                    .font(.system(size: 11, weight: .bold))
                    .foregroundStyle(theme.primary)
                    .padding(.horizontal, 10)
                    .padding(.vertical, 5)
                    .background(theme.primarySoft)
                    .clipShape(.rect(cornerRadius: 7))
                Spacer()
                if items.count > 1 {
                    Button {
                        items.remove(at: idx)
                    } label: {
                        Image(systemName: "trash")
                            .font(.system(size: 13, weight: .medium))
                            .foregroundStyle(theme.error)
                            .frame(width: 30, height: 30)
                            .background(theme.errorBg)
                            .clipShape(.rect(cornerRadius: 8))
                    }
                    .buttonStyle(.plain)
                }
            }
            .padding(.bottom, 12)

            formField("Producto *", text: item.product_name)

            HStack(spacing: 12) {
                formField("Cantidad", value: Binding(
                    get: { String(item.wrappedValue.quantity) },
                    set: { items[idx].quantity = Int($0) ?? 1 }
                ), keyboard: .numberPad)
                formField("Costo Unit.", value: Binding(
                    get: { String(item.wrappedValue.costo_unitario) },
                    set: { items[idx].costo_unitario = Double($0) ?? 0 }
                ), keyboard: .decimalPad)
            }

            HStack(spacing: 8) {
                formField("Total s/IVA", value: Binding(
                    get: { String(item.wrappedValue.total_sin_iva) },
                    set: { items[idx].total_sin_iva = Double($0) ?? 0 }
                ), keyboard: .decimalPad)
                formField("Dto. %", value: Binding(
                    get: { String(item.wrappedValue.descuento_porcentaje) },
                    set: { items[idx].descuento_porcentaje = Double($0) ?? 0 }
                ), keyboard: .decimalPad)
                formField("IVA %", value: Binding(
                    get: { String(item.wrappedValue.vat_percentage) },
                    set: { items[idx].vat_percentage = Double($0) ?? 0 }
                ), keyboard: .decimalPad)
            }

            HStack {
                Text("Sin IVA: \(Calculations.formatCurrency(calc.valor_sin_iva))")
                    .font(.system(size: 13))
                    .foregroundStyle(theme.textSecondary)
                Spacer()
                Text("Con IVA: \(Calculations.formatCurrency(calc.valor_con_iva))")
                    .font(.system(size: 13, weight: .bold))
                    .foregroundStyle(theme.primary)
            }
            .padding(.top, 10)
            .overlay(
                Rectangle().fill(theme.divider).frame(height: 1),
                alignment: .top
            )
        }
        .padding(16)
        .background(theme.background)
        .clipShape(.rect(cornerRadius: 14))
        .overlay(
            .rect(cornerRadius: 14)
                .stroke(theme.border, lineWidth: 1)
        )
        .padding(.bottom, 12)
    }

    // MARK: - Shipping card

    private func shippingCard(idx: Int) -> some View {
        let item = $shippingItems[idx]

        return VStack(alignment: .leading, spacing: 0) {
            HStack {
                Text("#\(idx + 1)")
                    .font(.system(size: 11, weight: .bold))
                    .foregroundStyle(theme.warning)
                    .padding(.horizontal, 10)
                    .padding(.vertical, 5)
                    .background(theme.warningBg)
                    .clipShape(.rect(cornerRadius: 7))
                Spacer()
                Button {
                    shippingItems.remove(at: idx)
                } label: {
                    Image(systemName: "trash")
                        .font(.system(size: 13, weight: .medium))
                        .foregroundStyle(theme.error)
                        .frame(width: 30, height: 30)
                        .background(theme.errorBg)
                        .clipShape(.rect(cornerRadius: 8))
                }
                .buttonStyle(.plain)
            }
            .padding(.bottom, 12)

            formField("Descripción", text: item.description)

            HStack(spacing: 8) {
                formField("Cantidad", value: Binding(
                    get: { String(item.wrappedValue.quantity) },
                    set: { shippingItems[idx].quantity = Int($0) ?? 1 }
                ), keyboard: .numberPad)
                formField("Costo", value: Binding(
                    get: { String(item.wrappedValue.costo_unitario) },
                    set: { shippingItems[idx].costo_unitario = Double($0) ?? 0 }
                ), keyboard: .decimalPad)
                formField("IVA %", value: Binding(
                    get: { String(item.wrappedValue.vat_percentage) },
                    set: { shippingItems[idx].vat_percentage = Double($0) ?? 0 }
                ), keyboard: .decimalPad)
            }
        }
        .padding(16)
        .background(isDark ? theme.surfaceAlt : Color(red: 0xFF/255, green: 0xFD/255, blue: 0xF7/255))
        .clipShape(.rect(cornerRadius: 14))
        .overlay(
            .rect(cornerRadius: 14)
                .stroke(isDark ? theme.border : theme.warning.opacity(0.3), lineWidth: 1)
        )
        .padding(.bottom, 12)
    }

    // MARK: - Totals card

    private var totalsCard: some View {
        VStack(spacing: 0) {
            totalRow("Subtotal (sin IVA)", Calculations.formatCurrency(totals.exVat))
            totalRow("IVA", Calculations.formatCurrency(totals.vat))
            totalRow("Envío", Calculations.formatCurrency(totals.shipping + shippingCost))

            Rectangle().fill(theme.border).frame(height: 1)
                .padding(.vertical, 12)

            HStack {
                Text("Total")
                    .font(.system(size: 16, weight: .bold))
                    .foregroundStyle(theme.text)
                Spacer()
                Text(Calculations.formatCurrency(totals.grand))
                    .font(.system(size: 20, weight: .heavy, design: .rounded))
                    .foregroundStyle(theme.primary)
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

    private func totalRow(_ label: String, _ value: String) -> some View {
        HStack {
            Text(label)
                .font(.system(size: 14))
                .foregroundStyle(theme.textSecondary)
            Spacer()
            Text(value)
                .font(.system(size: 14, weight: .semibold))
                .foregroundStyle(theme.text)
        }
        .padding(.vertical, 6)
    }

    // MARK: - Submit

    private func handleSubmit() {
        guard let mfrId = selectedManufacturerId else {
            let alert = UIAlertController(title: "Error", message: "Selecciona un fabricante", preferredStyle: .alert)
            alert.addAction(UIAlertAction(title: "OK", style: .default))
            UIApplication.shared.topVC()?.present(alert, animated: true)
            return
        }

        if items.contains(where: { $0.product_name.trimmingCharacters(in: .whitespaces).isEmpty }) {
            let alert = UIAlertController(title: "Error", message: "Indica el nombre de todos los productos", preferredStyle: .alert)
            alert.addAction(UIAlertAction(title: "OK", style: .default))
            UIApplication.shared.topVC()?.present(alert, animated: true)
            return
        }

        if let editingOrder {
            store.updateOrder(
                editingOrder.id,
                customer: customer,
                manufacturerId: mfrId,
                year: year,
                status: status,
                customReference: customReference,
                shippingCost: shippingCost,
                items: items,
                shippingItems: shippingItems
            )
        } else {
            _ = store.addOrder(
                customer: customer,
                manufacturerId: mfrId,
                year: year,
                status: status,
                customReference: customReference,
                shippingCost: shippingCost,
                items: items,
                shippingItems: shippingItems
            )
        }

        dismiss()
    }
}
