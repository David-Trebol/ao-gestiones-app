import Foundation

struct Calculations {

    static func calculateItemTotals(
        productName: String, quantity: Int, costoUnitario: Double,
        tpvUnitario: Double, totalSinIva: Double, descuento: Double, vat: Double
    ) -> OrderItem {
        var valorSinIva: Double = 0
        var pvpNetoSinIva: Double = 0

        if totalSinIva > 0 {
            valorSinIva = totalSinIva
            pvpNetoSinIva = quantity > 0 ? valorSinIva / Double(quantity) : 0
        } else {
            pvpNetoSinIva = tpvUnitario * (1 - descuento / 100)
            valorSinIva = pvpNetoSinIva * Double(quantity)
        }

        let beneficioBruto = pvpNetoSinIva - costoUnitario
        let valorConIva = valorSinIva * (1 + vat / 100)

        return OrderItem(
            product_name: productName,
            quantity: quantity,
            costo_unitario: costoUnitario,
            tpv_unitario: tpvUnitario,
            total_sin_iva: totalSinIva,
            descuento_porcentaje: descuento,
            pvp_neto_sin_iva: roundTo2(pvpNetoSinIva),
            valor_sin_iva: roundTo2(valorSinIva),
            beneficio_bruto: roundTo2(beneficioBruto),
            valor_con_iva: roundTo2(valorConIva),
            vat_percentage: vat
        )
    }

    static func calculateShippingTotals(
        description: String, quantity: Int, costoUnitario: Double,
        totalSinIva: Double, vat: Double
    ) -> ShippingItem {
        var valorSinIva: Double = 0
        if totalSinIva > 0 {
            valorSinIva = totalSinIva
        } else {
            valorSinIva = costoUnitario * Double(quantity)
        }
        let valorConIva = valorSinIva * (1 + vat / 100)

        return ShippingItem(
            description: description,
            quantity: quantity,
            costo_unitario: costoUnitario,
            total_sin_iva: totalSinIva,
            vat_percentage: vat,
            valor_sin_iva: roundTo2(valorSinIva),
            valor_con_iva: roundTo2(valorConIva)
        )
    }

    static func generateReferenceNumber(code: String, year: Int, count: Int) -> String {
        let num = String(format: "%03d", count + 1)
        return "\(code)-\(year)-\(num)"
    }

    static func formatCurrency(_ amount: Double) -> String {
        let formatter = NumberFormatter()
        formatter.numberStyle = .currency
        formatter.currencyCode = "EUR"
        formatter.locale = Locale(identifier: "es_ES")
        return formatter.string(from: NSNumber(value: amount)) ?? "€\(String(format: "%.2f", amount))"
    }

    static func formatDate(_ dateString: String) -> String {
        let date = ISO8601DateFormatter().date(from: dateString) ?? Date()
        let formatter = DateFormatter()
        formatter.dateFormat = "dd/MM/yyyy"
        return formatter.string(from: date)
    }

    static func formatDateLong(_ dateString: String) -> String {
        let date = ISO8601DateFormatter().date(from: dateString) ?? Date()
        let formatter = DateFormatter()
        formatter.dateFormat = "d MMM yyyy"
        formatter.locale = Locale(identifier: "es_ES")
        return formatter.string(from: date)
    }

    static func roundTo2(_ value: Double) -> Double {
        (value * 100).rounded() / 100
    }

    static func isoNow() -> String {
        ISO8601DateFormatter().string(from: Date())
    }
}
