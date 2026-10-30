import SwiftUI

struct ManufacturersView: View {
    @Environment(AppStore.self) private var store
    @State private var showCreateModal = false
    @State private var showEditModal = false
    @State private var showYearsModal = false
    @State private var selectedManufacturer: Manufacturer?
    @State private var formName = ""
    @State private var formCode = ""
    @State private var selectedYears: Set<Int> = []

    private var theme: ThemeColors { themeColors(for: store.themeMode) }

    var body: some View {
        VStack(spacing: 0) {
            // Header
            HStack {
                VStack(alignment: .leading, spacing: 2) {
                    Text("Fabricantes")
                        .font(.system(size: 24, weight: .heavy, design: .rounded))
                        .foregroundStyle(theme.text)
                    Text("\(store.manufacturers.count) fabricante\(store.manufacturers.count != 1 ? "s" : "")")
                        .font(.system(size: 14))
                        .foregroundStyle(theme.textSecondary)
                }
                Spacer()
                Button {
                    formName = ""
                    formCode = ""
                    showCreateModal = true
                } label: {
                    HStack(spacing: 6) {
                        Image(systemName: "plus")
                            .font(.system(size: 13, weight: .bold))
                        Text("Crear")
                            .font(.system(size: 14, weight: .bold))
                    }
                    .foregroundStyle(.white)
                    .padding(.horizontal, 18)
                    .padding(.vertical, 11)
                    .background(theme.accent)
                    .clipShape(.rect(cornerRadius: 12))
                }
                .buttonStyle(.plain)
            }
            .padding(.horizontal, 20)
            .padding(.top, 18)
            .padding(.bottom, 14)

            if store.manufacturers.isEmpty {
                Spacer()
                VStack(spacing: 18) {
                    Image(systemName: "building.2")
                        .font(.system(size: 38, weight: .medium))
                        .foregroundStyle(theme.textTertiary)
                        .frame(width: 80, height: 80)
                        .background(theme.surfaceAlt)
                        .clipShape(.rect(cornerRadius: 22))
                    Text("No hay fabricantes")
                        .font(.system(size: 19, weight: .bold, design: .rounded))
                        .foregroundStyle(theme.text)
                    Text("Crea tu primer fabricante para comenzar")
                        .font(.system(size: 14))
                        .foregroundStyle(theme.textSecondary)
                }
                Spacer()
            } else {
                ScrollView {
                    LazyVStack(spacing: 14) {
                        ForEach(store.manufacturers) { mfr in
                            manufacturerCard(mfr)
                        }
                    }
                    .padding(.horizontal, 20)
                    .padding(.top, 6)
                    .padding(.bottom, 40)
                }
            }
        }
        .background(theme.background.ignoresSafeArea())
        .sheet(isPresented: $showCreateModal) { createModal }
        .sheet(isPresented: $showEditModal) { editModal }
        .sheet(isPresented: $showYearsModal) { yearsModal }
        .navigationTitle("Fabricantes")
        .navigationBarTitleDisplayMode(.inline)
    }

    // MARK: - Card

    private func manufacturerCard(_ mfr: Manufacturer) -> some View {
        let orderCount = store.orders.filter { $0.manufacturer_id == mfr.id.uuidString }.count
        let sortedYears = mfr.active_years.sorted(by: >)

        return HStack(alignment: .top, spacing: 14) {
            // Left
            HStack(alignment: .top, spacing: 14) {
                Image(systemName: "building.2")
                    .font(.system(size: 17, weight: .semibold))
                    .foregroundStyle(theme.primary)
                    .frame(width: 42, height: 42)
                    .background(theme.primarySoft)
                    .clipShape(.rect(cornerRadius: 13))

                VStack(alignment: .leading, spacing: 0) {
                    Text(mfr.name)
                        .font(.system(size: 16, weight: .bold, design: .rounded))
                        .foregroundStyle(theme.text)
                        .lineLimit(1)

                    Text(mfr.code)
                        .font(.system(size: 12, weight: .medium, design: .monospaced))
                        .foregroundStyle(theme.textSecondary)
                        .padding(.top, 2)

                    // Year badges
                    if !sortedYears.isEmpty {
                        FlowLayout(spacing: 5) {
                            ForEach(sortedYears, id: \.self) { yr in
                                Text("\(yr)")
                                    .font(.system(size: 11, weight: .semibold))
                                    .foregroundStyle(theme.primary)
                                    .padding(.horizontal, 9)
                                    .padding(.vertical, 3)
                                    .background(theme.primarySoft)
                                    .overlay(
                                        .rect(cornerRadius: 7)
                                            .stroke(theme.primarySoftAlt, lineWidth: 1)
                                    )
                                    .clipShape(.rect(cornerRadius: 7))
                            }
                        }
                        .padding(.top, 8)
                    } else {
                        Text("Sin años asignados")
                            .font(.system(size: 12))
                            .italic()
                            .foregroundStyle(theme.textTertiary)
                            .padding(.top, 8)
                    }

                    Text("\(orderCount) pedido\(orderCount != 1 ? "s" : "")")
                        .font(.system(size: 12))
                        .foregroundStyle(theme.textSecondary)
                        .padding(.top, 6)
                }
            }

            Spacer()

            // Actions
            VStack(spacing: 8) {
                Button {
                    handleDuplicate(mfr)
                } label: {
                    Image(systemName: "doc.on.doc")
                        .font(.system(size: 14, weight: .medium))
                        .foregroundStyle(theme.primary)
                        .frame(width: 34, height: 34)
                        .background(theme.primarySoft)
                        .clipShape(.rect(cornerRadius: 9))
                }
                .buttonStyle(.plain)

                Button {
                    selectedManufacturer = mfr
                    selectedYears = Set(mfr.active_years)
                    showYearsModal = true
                } label: {
                    Image(systemName: "calendar")
                        .font(.system(size: 14, weight: .medium))
                        .foregroundStyle(theme.primary)
                        .frame(width: 34, height: 34)
                        .background(theme.surfaceAlt)
                        .clipShape(.rect(cornerRadius: 9))
                }
                .buttonStyle(.plain)

                Button {
                    selectedManufacturer = mfr
                    formName = mfr.name
                    formCode = mfr.code
                    showEditModal = true
                } label: {
                    Image(systemName: "pencil")
                        .font(.system(size: 14, weight: .medium))
                        .foregroundStyle(theme.textSecondary)
                        .frame(width: 34, height: 34)
                        .background(theme.surfaceAlt)
                        .clipShape(.rect(cornerRadius: 9))
                }
                .buttonStyle(.plain)

                Button {
                    handleDelete(mfr)
                } label: {
                    Image(systemName: "trash")
                        .font(.system(size: 14, weight: .medium))
                        .foregroundStyle(theme.error)
                        .frame(width: 34, height: 34)
                        .background(theme.errorBg)
                        .clipShape(.rect(cornerRadius: 9))
                }
                .buttonStyle(.plain)
            }
        }
        .padding(18)
        .frame(maxWidth: .infinity, minHeight: 124, alignment: .topLeading)
        .background(theme.surfaceElevated)
        .clipShape(.rect(cornerRadius: 18))
        .overlay(
            .rect(cornerRadius: 18)
                .stroke(theme.borderLight, lineWidth: 1)
        )
        .shadow(color: theme.cardShadow, radius: 14, y: 6)
        .contextMenu {
            Button("Duplicar", systemImage: "doc.on.doc") { handleDuplicate(mfr) }
            Button("Asignar Años", systemImage: "calendar") {
                selectedManufacturer = mfr
                selectedYears = Set(mfr.active_years)
                showYearsModal = true
            }
            Button("Editar", systemImage: "pencil") {
                selectedManufacturer = mfr
                formName = mfr.name
                formCode = mfr.code
                showEditModal = true
            }
            Button("Eliminar", systemImage: "trash", role: .destructive) { handleDelete(mfr) }
        }
    }

    // MARK: - Create modal

    private var createModal: some View {
        VStack(spacing: 0) {
            Text("Crear Fabricante")
                .font(.system(size: 21, weight: .heavy, design: .rounded))
                .foregroundStyle(theme.text)
                .padding(.bottom, 24)

            VStack(alignment: .leading, spacing: 7) {
                Text("NOMBRE *")
                    .font(.system(size: 12, weight: .semibold))
                    .tracking(0.5)
                    .foregroundStyle(theme.textSecondary)
                TextField("Ej: Acme Industries", text: $formName)
                    .font(.system(size: 15))
                    .foregroundStyle(theme.text)
                    .padding(.horizontal, 16)
                    .padding(.vertical, 13)
                    .background(theme.background)
                    .overlay(
                        .rect(cornerRadius: 12)
                            .stroke(theme.border, lineWidth: 1)
                    )
                    .clipShape(.rect(cornerRadius: 12))
            }
            .padding(.bottom, 18)

            VStack(alignment: .leading, spacing: 7) {
                Text("CÓDIGO *")
                    .font(.system(size: 12, weight: .semibold))
                    .tracking(0.5)
                    .foregroundStyle(theme.textSecondary)
                TextField("Ej: ACM", text: $formCode)
                    .font(.system(size: 15))
                    .foregroundStyle(theme.text)
                    .textInputAutocapitalization(.characters)
                    .padding(.horizontal, 16)
                    .padding(.vertical, 13)
                    .background(theme.background)
                    .overlay(
                        .rect(cornerRadius: 12)
                            .stroke(theme.border, lineWidth: 1)
                    )
                    .clipShape(.rect(cornerRadius: 12))
            }

            Spacer(minLength: 20)

            HStack(spacing: 12) {
                Button("Cancelar") { showCreateModal = false }
                    .font(.system(size: 14, weight: .semibold))
                    .foregroundStyle(theme.textSecondary)
                    .padding(.horizontal, 22)
                    .padding(.vertical, 12)
                    .overlay(
                        .rect(cornerRadius: 12)
                            .stroke(theme.border, lineWidth: 1)
                    )
                    .clipShape(.rect(cornerRadius: 12))

                Button("Crear") { handleCreate() }
                    .font(.system(size: 14, weight: .bold))
                    .foregroundStyle(.white)
                    .padding(.horizontal, 22)
                    .padding(.vertical, 12)
                    .background(theme.primary)
                    .clipShape(.rect(cornerRadius: 12))
            }
            .padding(.top, 18)
            .overlay(
                Rectangle().fill(theme.divider).frame(height: 1),
                alignment: .top
            )
        }
        .padding(24)
        .background(theme.surface)
        .clipShape(.rect(cornerRadius: 24))
        .frame(maxWidth: 440)
        .presentationDetents([.height(340)])
    }

    // MARK: - Edit modal

    private var editModal: some View {
        VStack(spacing: 0) {
            Text("Editar Fabricante")
                .font(.system(size: 21, weight: .heavy, design: .rounded))
                .foregroundStyle(theme.text)
                .padding(.bottom, 24)

            VStack(alignment: .leading, spacing: 7) {
                Text("NOMBRE *")
                    .font(.system(size: 12, weight: .semibold))
                    .tracking(0.5)
                    .foregroundStyle(theme.textSecondary)
                TextField("", text: $formName)
                    .font(.system(size: 15))
                    .foregroundStyle(theme.text)
                    .padding(.horizontal, 16)
                    .padding(.vertical, 13)
                    .background(theme.background)
                    .overlay(
                        .rect(cornerRadius: 12)
                            .stroke(theme.border, lineWidth: 1)
                    )
                    .clipShape(.rect(cornerRadius: 12))
            }
            .padding(.bottom, 18)

            VStack(alignment: .leading, spacing: 7) {
                Text("CÓDIGO *")
                    .font(.system(size: 12, weight: .semibold))
                    .tracking(0.5)
                    .foregroundStyle(theme.textSecondary)
                TextField("", text: $formCode)
                    .font(.system(size: 15))
                    .foregroundStyle(theme.text)
                    .textInputAutocapitalization(.characters)
                    .padding(.horizontal, 16)
                    .padding(.vertical, 13)
                    .background(theme.background)
                    .overlay(
                        .rect(cornerRadius: 12)
                            .stroke(theme.border, lineWidth: 1)
                    )
                    .clipShape(.rect(cornerRadius: 12))
            }

            Spacer(minLength: 20)

            HStack(spacing: 12) {
                Button("Cancelar") {
                    showEditModal = false
                    selectedManufacturer = nil
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

                Button("Actualizar") { handleEdit() }
                    .font(.system(size: 14, weight: .bold))
                    .foregroundStyle(.white)
                    .padding(.horizontal, 22)
                    .padding(.vertical, 12)
                    .background(theme.primary)
                    .clipShape(.rect(cornerRadius: 12))
            }
            .padding(.top, 18)
            .overlay(
                Rectangle().fill(theme.divider).frame(height: 1),
                alignment: .top
            )
        }
        .padding(24)
        .background(theme.surface)
        .clipShape(.rect(cornerRadius: 24))
        .frame(maxWidth: 440)
        .presentationDetents([.height(340)])
    }

    // MARK: - Years modal

    private var yearsModal: some View {
        VStack(spacing: 0) {
            Text("Asignar Años")
                .font(.system(size: 21, weight: .heavy, design: .rounded))
                .foregroundStyle(theme.text)
            Text(selectedManufacturer?.name ?? "")
                .font(.system(size: 14))
                .foregroundStyle(theme.textSecondary)
                .padding(.top, 4)

            Text("Selecciona los años activos:")
                .font(.system(size: 14))
                .foregroundStyle(theme.textSecondary)
                .padding(.top, 8)
                .padding(.bottom, 18)

            FlowLayout(spacing: 10) {
                ForEach(store.years, id: \.self) { yr in
                    let isSelected = selectedYears.contains(yr)
                    Button {
                        if isSelected { selectedYears.remove(yr) }
                        else { selectedYears.insert(yr) }
                    } label: {
                        HStack(spacing: 6) {
                            if isSelected {
                                Image(systemName: "checkmark")
                                    .font(.system(size: 14, weight: .bold))
                            }
                            Text("\(yr)")
                                .font(.system(size: 15, weight: .bold))
                        }
                        .foregroundStyle(isSelected ? theme.primary : theme.text)
                        .padding(.horizontal, 18)
                        .padding(.vertical, 13)
                        .background(isSelected ? theme.primarySoft : theme.surface)
                        .overlay(
                            .rect(cornerRadius: 12)
                                .stroke(isSelected ? theme.primary : theme.border, lineWidth: 2)
                        )
                        .clipShape(.rect(cornerRadius: 12))
                    }
                    .buttonStyle(.plain)
                }
            }

            Spacer(minLength: 20)

            HStack(spacing: 12) {
                Button("Cancelar") {
                    showYearsModal = false
                    selectedManufacturer = nil
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

                Button("Guardar") { saveYears() }
                    .font(.system(size: 14, weight: .bold))
                    .foregroundStyle(.white)
                    .padding(.horizontal, 22)
                    .padding(.vertical, 12)
                    .background(theme.primary)
                    .clipShape(.rect(cornerRadius: 12))
            }
            .padding(.top, 18)
            .overlay(
                Rectangle().fill(theme.divider).frame(height: 1),
                alignment: .top
            )
        }
        .padding(24)
        .background(theme.surface)
        .clipShape(.rect(cornerRadius: 24))
        .frame(maxWidth: 440)
        .presentationDetents([.height(400)])
    }

    // MARK: - Actions

    private func handleCreate() {
        guard !formName.trimmingCharacters(in: .whitespaces).isEmpty,
              !formCode.trimmingCharacters(in: .whitespaces).isEmpty else { return }
        _ = store.addManufacturer(name: formName.trimmingCharacters(in: .whitespaces),
                                  code: formCode.trimmingCharacters(in: .whitespaces))
        showCreateModal = false
        formName = ""
        formCode = ""
    }

    private func handleEdit() {
        guard let mfr = selectedManufacturer,
              !formName.trimmingCharacters(in: .whitespaces).isEmpty,
              !formCode.trimmingCharacters(in: .whitespaces).isEmpty else { return }
        store.updateManufacturer(mfr.id, name: formName.trimmingCharacters(in: .whitespaces),
                                 code: formCode.trimmingCharacters(in: .whitespaces), activeYears: nil)
        showEditModal = false
        selectedManufacturer = nil
        formName = ""
        formCode = ""
    }

    private func handleDelete(_ mfr: Manufacturer) {
        let alert = UIAlertController(
            title: "¿Eliminar fabricante?",
            message: "Se eliminará \"\(mfr.name)\". Solo se puede eliminar si no tiene pedidos.",
            preferredStyle: .alert
        )
        alert.addAction(UIAlertAction(title: "Cancelar", style: .cancel))
        alert.addAction(UIAlertAction(title: "Eliminar", style: .destructive) { _ in
            if !store.deleteManufacturer(mfr.id) {
                let errAlert = UIAlertController(title: "Error", message: "No se puede eliminar: tiene pedidos asociados", preferredStyle: .alert)
                errAlert.addAction(UIAlertAction(title: "OK", style: .default))
                UIApplication.shared.topVC()?.present(errAlert, animated: true)
            }
        })
        UIApplication.shared.topVC()?.present(alert, animated: true)
    }

    private func handleDuplicate(_ mfr: Manufacturer) {
        let newName = "\(mfr.name) (copia)"
        let newCode = "\(mfr.code)2"
        _ = store.addManufacturer(name: newName, code: newCode)
    }

    private func saveYears() {
        guard let mfr = selectedManufacturer else { return }
        store.updateManufacturer(mfr.id, name: nil, code: nil, activeYears: Array(selectedYears).sorted(by: >))
        showYearsModal = false
        selectedManufacturer = nil
    }
}

// MARK: - FlowLayout

struct FlowLayout: Layout {
    var spacing: CGFloat = 8

    func sizeThatFits(proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) -> CGSize {
        let maxWidth = proposal.width ?? .infinity
        var totalHeight: CGFloat = 0
        var totalWidth: CGFloat = 0
        var lineWidth: CGFloat = 0
        var lineHeight: CGFloat = 0

        for subview in subviews {
            let size = subview.sizeThatFits(.unspecified)
            if lineWidth + size.width > maxWidth && lineWidth > 0 {
                totalWidth = max(totalWidth, lineWidth)
                totalHeight += lineHeight + spacing
                lineWidth = size.width + spacing
                lineHeight = size.height
            } else {
                lineWidth += size.width + spacing
                lineHeight = max(lineHeight, size.height)
            }
        }
        totalWidth = max(totalWidth, lineWidth - spacing)
        totalHeight += lineHeight
        return CGSize(width: totalWidth, height: totalHeight)
    }

    func placeSubviews(in bounds: CGRect, proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) {
        let maxWidth = bounds.width
        var x = bounds.minX
        var y = bounds.minY
        var lineHeight: CGFloat = 0

        for subview in subviews {
            let size = subview.sizeThatFits(.unspecified)
            if x + size.width > bounds.minX + maxWidth && x > bounds.minX {
                x = bounds.minX
                y += lineHeight + spacing
                lineHeight = 0
            }
            subview.place(at: CGPoint(x: x, y: y), proposal: ProposedViewSize(size))
            x += size.width + spacing
            lineHeight = max(lineHeight, size.height)
        }
    }
}
