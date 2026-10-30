import Foundation

enum SampleData {
    static func sampleOrders(manufacturers: [Manufacturer]) -> [Order] {
        let mfr1 = manufacturers.first(where: { $0.code == "ACM" })!
        let mfr2 = manufacturers.first(where: { $0.code == "TPG" })!
        let mfr3 = manufacturers.first(where: { $0.code == "EUR" })!

        func customer(_ nombre: String, _ contacto: String, _ dept: String, _ ref: String,
                      _ dir1: String, _ dir2: String, _ cp: String, _ prov: String,
                      _ tel1: String, _ tel2: String, _ email: String, _ nif: String,
                      _ oferta: String, _ condE: String, _ condP: String,
                      _ factura: String, _ recibo: String) -> Customer {
            Customer(nombre_empresa: nombre, contacto: contacto, departamento: dept,
                     numero_referencia_pedido: ref, direccion_1: dir1, direccion_2: dir2,
                     codigo_postal: cp, provincia: prov, pais: "España",
                     telefono_1: tel1, telefono_2: tel2, email: email, nif: nif,
                     oferta_proforma: oferta, condiciones_entrega: condE,
                     condiciones_pago: condP, numero_factura: factura, numero_recibo: recibo)
        }

        func item(_ name: String, _ qty: Int, _ costo: Double, _ tpv: Double,
                  _ total: Double, _ dto: Double, _ pvp: Double, _ vsi: Double,
                  _ ben: Double, _ vci: Double, _ iva: Double) -> OrderItem {
            OrderItem(product_name: name, quantity: qty, costo_unitario: costo,
                      tpv_unitario: tpv, total_sin_iva: total, descuento_porcentaje: dto,
                      pvp_neto_sin_iva: pvp, valor_sin_iva: vsi, beneficio_bruto: ben,
                      valor_con_iva: vci, vat_percentage: iva)
        }

        func ship(_ desc: String, _ qty: Int, _ costo: Double, _ total: Double,
                  _ iva: Double, _ vsi: Double, _ vci: Double) -> ShippingItem {
            ShippingItem(description: desc, quantity: qty, costo_unitario: costo,
                         total_sin_iva: total, vat_percentage: iva,
                         valor_sin_iva: vsi, valor_con_iva: vci)
        }

        return [
            Order(
                reference_number: "ACM-2026-001", custom_reference: "PO-2026-A1",
                manufacturer_id: mfr1.id.uuidString, manufacturer_name: mfr1.name,
                manufacturer_code: mfr1.code, year: 2026, status: .delivered,
                customer: customer("Construcciones García S.A.", "María García", "Compras", "CG-2026-100",
                                   "Calle Mayor 15", "Planta 3", "28001", "Madrid",
                                   "+34 912 345 678", "+34 600 123 456",
                                   "compras@construccionesgarcia.es", "A12345678",
                                   "PRF-2026-001", "DDP Madrid", "30 días fecha factura",
                                   "FA-2026-0051", ""),
                items: [
                    item("Motor eléctrico 5HP", 2, 320, 480, 0, 5, 456, 912, 136, 1103.52, 21),
                    item("Controlador PLC Siemens", 1, 890, 1250, 0, 0, 1250, 1250, 360, 1512.50, 21),
                ],
                shipping_items: [
                    ship("Transporte urgente", 1, 45, 45, 21, 45, 54.45),
                ],
                shipping_cost: 0,
                total_ex_vat: 2162, total_vat: 453.99, total_with_vat: 2670.47,
                created_at: "2026-01-10T14:30:00Z", updated_at: "2026-02-01T09:15:00Z"
            ),
            Order(
                reference_number: "ACM-2026-002", custom_reference: "",
                manufacturer_id: mfr1.id.uuidString, manufacturer_name: mfr1.name,
                manufacturer_code: mfr1.code, year: 2026, status: .processing,
                customer: customer("Instalaciones López", "Pedro López", "", "",
                                   "Av. Libertad 42", "", "08001", "Barcelona",
                                   "+34 933 222 111", "",
                                   "pedro@instalacioneslopez.com", "B87654321",
                                   "", "", "Contado", "", ""),
                items: [
                    item("Válvula industrial DN50", 10, 45, 72, 0, 10, 64.8, 648, 19.8, 784.08, 21),
                ],
                shipping_items: [],
                shipping_cost: 25,
                total_ex_vat: 648, total_vat: 136.08, total_with_vat: 809.08,
                created_at: "2026-02-05T11:20:00Z", updated_at: "2026-02-05T11:20:00Z"
            ),
            Order(
                reference_number: "TPG-2026-001", custom_reference: "REF-EXT-445",
                manufacturer_id: mfr2.id.uuidString, manufacturer_name: mfr2.name,
                manufacturer_code: mfr2.code, year: 2026, status: .pending,
                customer: customer("Electrónica Moderna S.L.", "Ana Ruiz", "Ingeniería", "EM-PO-2026-33",
                                   "Polígono Industrial Norte, Nave 7", "", "46001", "Valencia",
                                   "+34 963 444 555", "",
                                   "ana.ruiz@electronicamoderna.es", "B55667788",
                                   "OFR-TPG-2026-12", "EXW Origen", "60 días", "", ""),
                items: [
                    item("Sensor de temperatura PT100", 20, 15, 28, 0, 0, 28, 560, 13, 677.60, 21),
                    item("Cable termopar tipo K 100m", 5, 65, 95, 0, 5, 90.25, 451.25, 25.25, 546.01, 21),
                ],
                shipping_items: [],
                shipping_cost: 0,
                total_ex_vat: 1011.25, total_vat: 212.36, total_with_vat: 1223.61,
                created_at: "2026-02-15T16:45:00Z", updated_at: "2026-02-15T16:45:00Z"
            ),
            Order(
                reference_number: "EUR-2025-001", custom_reference: "",
                manufacturer_id: mfr3.id.uuidString, manufacturer_name: mfr3.name,
                manufacturer_code: mfr3.code, year: 2025, status: .delivered,
                customer: customer("Ferretería Central", "Juan Martín", "", "",
                                   "Plaza España 5", "", "41001", "Sevilla",
                                   "+34 954 111 222", "",
                                   "juan@ferreteriacentral.es", "B11223344",
                                   "", "", "Contado", "FA-EUR-2025-089", "REC-2025-045"),
                items: [
                    item("Tornillería M8 (caja 500ud)", 3, 22, 38, 0, 0, 38, 114, 16, 137.94, 21),
                ],
                shipping_items: [],
                shipping_cost: 8,
                total_ex_vat: 114, total_vat: 23.94, total_with_vat: 145.94,
                created_at: "2025-09-20T08:30:00Z", updated_at: "2025-10-05T14:00:00Z"
            ),
            Order(
                reference_number: "EUR-2025-002", custom_reference: "MI-REF-2025",
                manufacturer_id: mfr3.id.uuidString, manufacturer_name: mfr3.name,
                manufacturer_code: mfr3.code, year: 2025, status: .shipped,
                customer: customer("Talleres Mecánicos del Sur", "Carlos Fernández", "Producción", "TMS-PO-100",
                                   "Camino Industrial 23", "Sector B", "29001", "Málaga",
                                   "+34 952 333 444", "+34 600 555 666",
                                   "carlos@talleresdelsur.es", "B99887766",
                                   "PRF-EUR-2025-042", "DAP destino", "45 días", "", ""),
                items: [
                    item("Rodamiento SKF 6205", 50, 8, 14.5, 0, 15, 12.33, 616.25, 4.33, 745.66, 21),
                    item("Grasa lubricante industrial 5kg", 2, 35, 55, 0, 0, 55, 110, 20, 133.10, 21),
                ],
                shipping_items: [
                    ship("Envío estándar península", 1, 18, 18, 21, 18, 21.78),
                ],
                shipping_cost: 0,
                total_ex_vat: 726.25, total_vat: 152.51, total_with_vat: 900.54,
                created_at: "2025-11-10T10:00:00Z", updated_at: "2025-12-01T16:30:00Z"
            ),
            Order(
                reference_number: "ACM-2025-001", custom_reference: "",
                manufacturer_id: mfr1.id.uuidString, manufacturer_name: mfr1.name,
                manufacturer_code: mfr1.code, year: 2025, status: .cancelled,
                customer: customer("Distribuciones Norte", "Laura Sánchez", "", "",
                                   "Calle Industrial 8", "", "48001", "Bilbao",
                                   "+34 944 777 888", "",
                                   "laura@distribnorte.com", "A44556677",
                                   "", "", "", "", ""),
                items: [
                    item("Compresor de aire 10bar", 1, 1200, 1800, 0, 0, 1800, 1800, 600, 2178, 21),
                ],
                shipping_items: [],
                shipping_cost: 0,
                total_ex_vat: 1800, total_vat: 378, total_with_vat: 2178,
                created_at: "2025-04-15T09:00:00Z", updated_at: "2025-05-01T11:00:00Z"
            ),
        ]
    }
}
