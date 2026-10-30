import Foundation
import SwiftUI

@Observable
final class AppStore {
    var orders: [Order] = []
    var manufacturers: [Manufacturer] = []
    var years: [Int] = []
    var themeMode: ThemeMode = .light
    var currentUser: AppUser?
    var users: [AppUser] = []

    private let ordersKey = "flow_orders"
    private let manufacturersKey = "flow_manufacturers"
    private let yearsKey = "flow_years"
    private let initializedKey = "flow_initialized"
    private let themeKey = "flow_theme_mode"
    private let usersKey = "flow_users"
    private let currentUserKey = "flow_current_user"

    init() {
        loadAll()
    }

    // MARK: - Load

    func loadAll() {
        loadTheme()
        loadUsers()
        loadCurrentUser()

        let initialized = UserDefaults.standard.bool(forKey: initializedKey)
        if !initialized {
            seedSampleData()
            return
        }

        loadOrders()
        loadManufacturers()
        loadYears()
    }

    private func seedSampleData() {
        let now = Calculations.isoNow()
        manufacturers = [
            Manufacturer(id: UUID(uuidString: "00000000-0000-0000-0000-000000000001")!, name: "Acme Industries", code: "ACM", active_years: [2024, 2025, 2026], created_at: "2024-01-15T10:00:00Z"),
            Manufacturer(id: UUID(uuidString: "00000000-0000-0000-0000-000000000002")!, name: "TechParts Global", code: "TPG", active_years: [2025, 2026], created_at: "2024-03-20T10:00:00Z"),
            Manufacturer(id: UUID(uuidString: "00000000-0000-0000-0000-000000000003")!, name: "EuroSupply S.L.", code: "EUR", active_years: [2024, 2025, 2026], created_at: "2024-06-10T10:00:00Z"),
            Manufacturer(id: UUID(uuidString: "00000000-0000-0000-0000-000000000004")!, name: "Nordic Components", code: "NRD", active_years: [2026], created_at: "2025-01-05T10:00:00Z"),
        ]

        years = [2024, 2025, 2026]

        orders = SampleData.sampleOrders(manufacturers: manufacturers)
        saveAll()
        UserDefaults.standard.set(true, forKey: initializedKey)
    }

    private func loadTheme() {
        if let raw = UserDefaults.standard.string(forKey: themeKey) {
            themeMode = ThemeMode(rawValue: raw) ?? .light
        }
    }

    private func loadOrders() {
        if let data = UserDefaults.standard.data(forKey: ordersKey) {
            orders = (try? JSONDecoder().decode([Order].self, from: data)) ?? []
        }
    }

    private func loadManufacturers() {
        if let data = UserDefaults.standard.data(forKey: manufacturersKey) {
            manufacturers = (try? JSONDecoder().decode([Manufacturer].self, from: data)) ?? []
        }
    }

    private func loadYears() {
        if let data = UserDefaults.standard.data(forKey: yearsKey) {
            years = (try? JSONDecoder().decode([Int].self, from: data)) ?? []
        }
    }

    private func loadUsers() {
        if let data = UserDefaults.standard.data(forKey: usersKey) {
            users = (try? JSONDecoder().decode([AppUser].self, from: data)) ?? []
        }
        if users.isEmpty {
            users = [AppUser(
                id: UUID(uuidString: "00000000-0000-0000-0000-0000000000AA")!,
                username: "admin",
                password: "admin123",
                displayName: "Administrador",
                role: "admin",
                active: true,
                created_at: Calculations.isoNow(),
                authProvider: "local"
            )]
            saveUsers()
        }
    }

    private func loadCurrentUser() {
        if let data = UserDefaults.standard.data(forKey: currentUserKey) {
            currentUser = try? JSONDecoder().decode(AppUser.self, from: data)
        }
    }

    // MARK: - Save

    private func saveOrders() {
        if let data = try? JSONEncoder().encode(orders) {
            UserDefaults.standard.set(data, forKey: ordersKey)
        }
    }

    private func saveManufacturers() {
        if let data = try? JSONEncoder().encode(manufacturers) {
            UserDefaults.standard.set(data, forKey: manufacturersKey)
        }
    }

    private func saveYears() {
        if let data = try? JSONEncoder().encode(years) {
            UserDefaults.standard.set(data, forKey: yearsKey)
        }
    }

    private func saveUsers() {
        if let data = try? JSONEncoder().encode(users) {
            UserDefaults.standard.set(data, forKey: usersKey)
        }
    }

    private func saveCurrentUser() {
        if let user = currentUser, let data = try? JSONEncoder().encode(user) {
            UserDefaults.standard.set(data, forKey: currentUserKey)
        } else {
            UserDefaults.standard.removeObject(forKey: currentUserKey)
        }
    }

    private func saveAll() {
        saveOrders()
        saveManufacturers()
        saveYears()
    }

    // MARK: - Theme

    func setTheme(_ mode: ThemeMode) {
        themeMode = mode
        UserDefaults.standard.set(mode.rawValue, forKey: themeKey)
    }

    func toggleTheme() {
        setTheme(themeMode == .light ? .dark : .light)
    }

    // MARK: - Auth

    func login(username: String, password: String) -> Bool {
        guard let user = users.first(where: {
            $0.username.lowercased() == username.lowercased() &&
            $0.password == password &&
            $0.authProvider != "google"
        }) else { return false }

        guard user.active else { return false }
        currentUser = user
        saveCurrentUser()
        return true
    }

    func logout() {
        currentUser = nil
        saveCurrentUser()
    }

    func addUser(username: String, password: String, displayName: String, role: String) -> Bool {
        guard !users.contains(where: { $0.username.lowercased() == username.lowercased() }) else {
            return false
        }
        let newUser = AppUser(
            username: username, password: password,
            displayName: displayName, role: role,
            active: true, created_at: Calculations.isoNow(),
            authProvider: "local"
        )
        users.append(newUser)
        saveUsers()
        return true
    }

    func updateUser(_ userId: UUID, username: String?, password: String?, displayName: String?, role: String?, active: Bool?) -> Bool {
        if let username, users.contains(where: { $0.id != userId && $0.username.lowercased() == username.lowercased() }) {
            return false
        }
        guard let idx = users.firstIndex(where: { $0.id == userId }) else { return false }
        if let username { users[idx].username = username }
        if let password, !password.isEmpty { users[idx].password = password }
        if let displayName { users[idx].displayName = displayName }
        if let role { users[idx].role = role }
        if let active { users[idx].active = active }
        saveUsers()

        if currentUser?.id == userId {
            currentUser = users[idx]
            saveCurrentUser()
        }
        return true
    }

    func deleteUser(_ userId: UUID) -> Bool {
        guard userId != UUID(uuidString: "00000000-0000-0000-0000-0000000000AA")! else { return false }
        guard currentUser?.id != userId else { return false }
        users.removeAll { $0.id == userId }
        saveUsers()
        return true
    }

    // MARK: - Orders

    func addOrder(customer: Customer, manufacturerId: UUID, year: Int, status: OrderStatus,
                  customReference: String, shippingCost: Double,
                  items: [OrderFormItem], shippingItems: [ShippingFormItem]) -> Order {
        guard let mfr = manufacturers.first(where: { $0.id == manufacturerId }) else {
            return Order()
        }

        let existingCount = orders.filter { $0.manufacturer_id == mfr.idString && $0.year == year }.count
        let calculatedItems = items.map { Calculations.calculateItemTotals(
            productName: $0.product_name, quantity: $0.quantity,
            costoUnitario: $0.costo_unitario, tpvUnitario: $0.tpv_unitario,
            totalSinIva: $0.total_sin_iva, descuento: $0.descuento_porcentaje, vat: $0.vat_percentage
        )}
        let calculatedShipping = shippingItems.map { Calculations.calculateShippingTotals(
            description: $0.description, quantity: $0.quantity,
            costoUnitario: $0.costo_unitario, totalSinIva: $0.total_sin_iva, vat: $0.vat_percentage
        )}

        let totalExVat = calculatedItems.reduce(0) { $0 + $1.valor_sin_iva }
        let totalVat = calculatedItems.reduce(0) { $0 + ($1.valor_con_iva - $1.valor_sin_iva) }
        let shippingTotal = calculatedShipping.reduce(0) { $0 + $1.valor_con_iva }
        let now = Calculations.isoNow()

        let order = Order(
            reference_number: Calculations.generateReferenceNumber(code: mfr.code, year: year, count: existingCount),
            custom_reference: customReference,
            manufacturer_id: mfr.idString, manufacturer_name: mfr.name, manufacturer_code: mfr.code,
            year: year, status: status, customer: customer,
            items: calculatedItems, shipping_items: calculatedShipping,
            shipping_cost: shippingCost,
            total_ex_vat: Calculations.roundTo2(totalExVat),
            total_vat: Calculations.roundTo2(totalVat),
            total_with_vat: Calculations.roundTo2(totalExVat + totalVat + shippingTotal + shippingCost),
            created_at: now, updated_at: now
        )
        orders.append(order)
        saveOrders()

        if !years.contains(year) {
            years.append(year)
            years.sort(by: >)
            saveYears()
        }

        return order
    }

    func updateOrder(_ orderId: UUID, customer: Customer, manufacturerId: UUID, year: Int, status: OrderStatus,
                     customReference: String, shippingCost: Double,
                     items: [OrderFormItem], shippingItems: [ShippingFormItem]) {
        guard let idx = orders.firstIndex(where: { $0.id == orderId }) else { return }
        guard let mfr = manufacturers.first(where: { $0.id == manufacturerId }) else { return }

        let calculatedItems = items.map { Calculations.calculateItemTotals(
            productName: $0.product_name, quantity: $0.quantity,
            costoUnitario: $0.costo_unitario, tpvUnitario: $0.tpv_unitario,
            totalSinIva: $0.total_sin_iva, descuento: $0.descuento_porcentaje, vat: $0.vat_percentage
        )}
        let calculatedShipping = shippingItems.map { Calculations.calculateShippingTotals(
            description: $0.description, quantity: $0.quantity,
            costoUnitario: $0.costo_unitario, totalSinIva: $0.total_sin_iva, vat: $0.vat_percentage
        )}

        let totalExVat = calculatedItems.reduce(0) { $0 + $1.valor_sin_iva }
        let totalVat = calculatedItems.reduce(0) { $0 + ($1.valor_con_iva - $1.valor_sin_iva) }
        let shippingTotal = calculatedShipping.reduce(0) { $0 + $1.valor_con_iva }

        orders[idx].custom_reference = customReference
        orders[idx].manufacturer_id = mfr.idString
        orders[idx].manufacturer_name = mfr.name
        orders[idx].manufacturer_code = mfr.code
        orders[idx].year = year
        orders[idx].status = status
        orders[idx].customer = customer
        orders[idx].items = calculatedItems
        orders[idx].shipping_items = calculatedShipping
        orders[idx].shipping_cost = shippingCost
        orders[idx].total_ex_vat = Calculations.roundTo2(totalExVat)
        orders[idx].total_vat = Calculations.roundTo2(totalVat)
        orders[idx].total_with_vat = Calculations.roundTo2(totalExVat + totalVat + shippingTotal + shippingCost)
        orders[idx].updated_at = Calculations.isoNow()

        saveOrders()
    }

    func deleteOrder(_ orderId: UUID) {
        orders.removeAll { $0.id == orderId }
        saveOrders()
    }

    func duplicateOrder(_ orderId: UUID, targetYear: Int? = nil) -> Order? {
        guard let original = orders.first(where: { $0.id == orderId }) else { return nil }
        let year = targetYear ?? original.year
        let mfr = manufacturers.first(where: { $0.id.uuidString == original.manufacturer_id })
        let existingCount = orders.filter { $0.manufacturer_id == original.manufacturer_id && $0.year == year }.count
        let now = Calculations.isoNow()

        var dup = original
        dup.id = UUID()
        dup.reference_number = mfr != nil
            ? Calculations.generateReferenceNumber(code: mfr!.code, year: year, count: existingCount)
            : "DUP-\(UUID().uuidString.prefix(6))"
        dup.custom_reference = original.custom_reference.isEmpty ? "" : "\(original.custom_reference) (copia)"
        dup.year = year
        dup.created_at = now
        dup.updated_at = now

        orders.append(dup)
        saveOrders()

        if !years.contains(year) {
            years.append(year)
            years.sort(by: >)
            saveYears()
        }

        return dup
    }

    func updateOrderField(_ orderId: UUID, field: String, value: String) {
        guard let idx = orders.firstIndex(where: { $0.id == orderId }) else { return }
        if field == "custom_reference" {
            orders[idx].custom_reference = value
            orders[idx].updated_at = Calculations.isoNow()
            saveOrders()
        }
    }

    // MARK: - Manufacturers

    func addManufacturer(name: String, code: String) -> Manufacturer {
        let mfr = Manufacturer(name: name, code: code.uppercased(), active_years: [], created_at: Calculations.isoNow())
        manufacturers.append(mfr)
        saveManufacturers()
        return mfr
    }

    func updateManufacturer(_ id: UUID, name: String?, code: String?, activeYears: [Int]?) {
        guard let idx = manufacturers.firstIndex(where: { $0.id == id }) else { return }
        if let name { manufacturers[idx].name = name }
        if let code { manufacturers[idx].code = code.uppercased() }
        if let activeYears { manufacturers[idx].active_years = activeYears }
        saveManufacturers()
    }

    func deleteManufacturer(_ id: UUID) -> Bool {
        let hasOrders = orders.contains { $0.manufacturer_id == id.uuidString }
        if hasOrders { return false }
        manufacturers.removeAll { $0.id == id }
        saveManufacturers()
        return true
    }

    // MARK: - Years

    func addYear(_ year: Int) -> Bool {
        if years.contains(year) { return false }
        years.append(year)
        years.sort(by: >)
        saveYears()
        return true
    }

    func deleteYear(_ year: Int) {
        orders.removeAll { $0.year == year }
        years.removeAll { $0 == year }
        saveOrders()
        saveYears()
    }

    // MARK: - Query helpers

    func ordersByYear(_ year: Int) -> [Order] {
        orders.filter { $0.year == year }
    }

    func ordersByManufacturerAndYear(_ mfrId: UUID, year: Int) -> [Order] {
        orders.filter { $0.manufacturer_id == mfrId.uuidString && $0.year == year }
    }

    func manufacturersForYear(_ year: Int) -> [Manufacturer] {
        let active = manufacturers.filter { $0.active_years.contains(year) }
        let withOrders = Set(orders.filter { $0.year == year }.map { $0.manufacturer_id })
        let allIds = Set(active.map { $0.idString }).union(withOrders)
        return manufacturers
            .filter { allIds.contains($0.idString) }
            .sorted { $0.name.localizedCaseInsensitiveCompare($1.name) == .orderedAscending }
    }

    func searchOrders(_ term: String) -> [Order] {
        guard !term.trimmingCharacters(in: .whitespaces).isEmpty else { return [] }
        let t = term.lowercased()
        return orders.filter { order in
            if order.reference_number.lowercased().contains(t) { return true }
            if order.custom_reference.lowercased().contains(t) { return true }
            let c = order.customer
            if c.nombre_empresa.lowercased().contains(t) { return true }
            if c.contacto.lowercased().contains(t) { return true }
            if c.email.lowercased().contains(t) { return true }
            if c.nif.lowercased().contains(t) { return true }
            if c.telefono_1.lowercased().contains(t) { return true }
            if c.provincia.lowercased().contains(t) { return true }
            if c.direccion_1.lowercased().contains(t) { return true }
            if c.numero_factura.lowercased().contains(t) { return true }
            if order.manufacturer_name.lowercased().contains(t) { return true }
            if order.manufacturer_code.lowercased().contains(t) { return true }
            if order.items.contains(where: { $0.product_name.lowercased().contains(t) }) { return true }
            if order.shipping_items.contains(where: { $0.description.lowercased().contains(t) }) { return true }
            if String(order.year).contains(t) { return true }
            if order.status.rawValue.contains(t) { return true }
            return false
        }
    }

    func matchedField(for order: Order, term: String) -> (field: String, value: String)? {
        let t = term.lowercased()
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

    var allYears: [Int] {
        let combined = Set(years).union(Set(orders.map { $0.year }))
        return Array(combined).sorted(by: >)
    }

    func resetData() {
        UserDefaults.standard.removeObject(forKey: initializedKey)
        UserDefaults.standard.removeObject(forKey: ordersKey)
        UserDefaults.standard.removeObject(forKey: manufacturersKey)
        UserDefaults.standard.removeObject(forKey: yearsKey)
        seedSampleData()
    }

    func clearAllData() {
        orders = []
        manufacturers = []
        years = []
        saveAll()
    }
}

// MARK: - Form intermediate types

struct OrderFormItem: Identifiable {
    let id = UUID()
    var product_name: String = ""
    var quantity: Int = 1
    var costo_unitario: Double = 0
    var tpv_unitario: Double = 0
    var total_sin_iva: Double = 0
    var descuento_porcentaje: Double = 0
    var vat_percentage: Double = 21
}

struct ShippingFormItem: Identifiable {
    let id = UUID()
    var description: String = ""
    var quantity: Int = 1
    var costo_unitario: Double = 0
    var total_sin_iva: Double = 0
    var vat_percentage: Double = 21
}
