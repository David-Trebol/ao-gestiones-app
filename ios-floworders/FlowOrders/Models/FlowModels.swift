import Foundation

enum OrderStatus: String, Codable, CaseIterable {
    case pending
    case processing
    case shipped
    case delivered
    case cancelled

    var label: String {
        switch self {
        case .pending: return "Pendiente"
        case .processing: return "Procesando"
        case .shipped: return "Enviado"
        case .delivered: return "Entregado"
        case .cancelled: return "Cancelado"
        }
    }

    var shortLabel: String {
        switch self {
        case .pending: return "Pend."
        case .processing: return "Proc."
        case .shipped: return "Env."
        case .delivered: return "Entreg."
        case .cancelled: return "Canc."
        }
    }

    var sfSymbol: String {
        switch self {
        case .pending: return "clock"
        case .processing: return "arrow.triangle.2.circlepath"
        case .shipped: return "truck.box"
        case .delivered: return "checkmark.circle"
        case .cancelled: return "xmark.circle"
        }
    }
}

struct Customer: Codable, Identifiable {
    var id = UUID()
    var nombre_empresa: String = ""
    var contacto: String = ""
    var departamento: String = ""
    var numero_referencia_pedido: String = ""
    var direccion_1: String = ""
    var direccion_2: String = ""
    var codigo_postal: String = ""
    var provincia: String = ""
    var pais: String = "España"
    var telefono_1: String = ""
    var telefono_2: String = ""
    var email: String = ""
    var nif: String = ""
    var oferta_proforma: String = ""
    var condiciones_entrega: String = ""
    var condiciones_pago: String = ""
    var numero_factura: String = ""
    var numero_recibo: String = ""

    enum CodingKeys: String, CodingKey {
        case nombre_empresa, contacto, departamento, numero_referencia_pedido
        case direccion_1, direccion_2, codigo_postal, provincia, pais
        case telefono_1, telefono_2, email, nif, oferta_proforma
        case condiciones_entrega, condiciones_pago, numero_factura, numero_recibo
    }

    init() {}

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        nombre_empresa = try c.decodeIfPresent(String.self, forKey: .nombre_empresa) ?? ""
        contacto = try c.decodeIfPresent(String.self, forKey: .contacto) ?? ""
        departamento = try c.decodeIfPresent(String.self, forKey: .departamento) ?? ""
        numero_referencia_pedido = try c.decodeIfPresent(String.self, forKey: .numero_referencia_pedido) ?? ""
        direccion_1 = try c.decodeIfPresent(String.self, forKey: .direccion_1) ?? ""
        direccion_2 = try c.decodeIfPresent(String.self, forKey: .direccion_2) ?? ""
        codigo_postal = try c.decodeIfPresent(String.self, forKey: .codigo_postal) ?? ""
        provincia = try c.decodeIfPresent(String.self, forKey: .provincia) ?? ""
        pais = try c.decodeIfPresent(String.self, forKey: .pais) ?? "España"
        telefono_1 = try c.decodeIfPresent(String.self, forKey: .telefono_1) ?? ""
        telefono_2 = try c.decodeIfPresent(String.self, forKey: .telefono_2) ?? ""
        email = try c.decodeIfPresent(String.self, forKey: .email) ?? ""
        nif = try c.decodeIfPresent(String.self, forKey: .nif) ?? ""
        oferta_proforma = try c.decodeIfPresent(String.self, forKey: .oferta_proforma) ?? ""
        condiciones_entrega = try c.decodeIfPresent(String.self, forKey: .condiciones_entrega) ?? ""
        condiciones_pago = try c.decodeIfPresent(String.self, forKey: .condiciones_pago) ?? ""
        numero_factura = try c.decodeIfPresent(String.self, forKey: .numero_factura) ?? ""
        numero_recibo = try c.decodeIfPresent(String.self, forKey: .numero_recibo) ?? ""
    }
}

struct OrderItem: Codable, Identifiable {
    var id = UUID()
    var product_name: String = ""
    var quantity: Int = 1
    var costo_unitario: Double = 0
    var tpv_unitario: Double = 0
    var total_sin_iva: Double = 0
    var descuento_porcentaje: Double = 0
    var pvp_neto_sin_iva: Double = 0
    var valor_sin_iva: Double = 0
    var beneficio_bruto: Double = 0
    var valor_con_iva: Double = 0
    var vat_percentage: Double = 21

    enum CodingKeys: String, CodingKey {
        case product_name, quantity, costo_unitario, tpv_unitario, total_sin_iva
        case descuento_porcentaje, pvp_neto_sin_iva, valor_sin_iva
        case beneficio_bruto, valor_con_iva, vat_percentage
    }
}

struct ShippingItem: Codable, Identifiable {
    var id = UUID()
    var description: String = ""
    var quantity: Int = 1
    var costo_unitario: Double = 0
    var total_sin_iva: Double = 0
    var vat_percentage: Double = 21
    var valor_sin_iva: Double = 0
    var valor_con_iva: Double = 0

    enum CodingKeys: String, CodingKey {
        case description, quantity, costo_unitario, total_sin_iva
        case vat_percentage, valor_sin_iva, valor_con_iva
    }
}

struct Order: Codable, Identifiable {
    var id = UUID()
    var reference_number: String = ""
    var custom_reference: String = ""
    var manufacturer_id: String = ""
    var manufacturer_name: String = ""
    var manufacturer_code: String = ""
    var year: Int = 2026
    var status: OrderStatus = .pending
    var customer: Customer = Customer()
    var items: [OrderItem] = []
    var shipping_items: [ShippingItem] = []
    var shipping_cost: Double = 0
    var total_ex_vat: Double = 0
    var total_vat: Double = 0
    var total_with_vat: Double = 0
    var created_at: String = ""
    var updated_at: String = ""

    var createdDate: Date {
        ISO8601DateFormatter().date(from: created_at) ?? Date()
    }

    var updatedDate: Date {
        ISO8601DateFormatter().date(from: updated_at) ?? Date()
    }
}

struct Manufacturer: Codable, Identifiable {
    var id = UUID()
    var name: String = ""
    var code: String = ""
    var active_years: [Int] = []
    var created_at: String = ""

    var idString: String { id.uuidString }
}

struct AppUser: Codable, Identifiable {
    var id = UUID()
    var username: String = ""
    var password: String = ""
    var displayName: String = ""
    var role: String = "user"
    var active: Bool = true
    var created_at: String = ""
    var email: String = ""
    var authProvider: String = "local"

    var isAdmin: Bool { role == "admin" }
}
