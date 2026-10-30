import SwiftUI

struct SettingsView: View {
    @Environment(AppStore.self) private var store
    @State private var showUserModal = false
    @State private var editingUser: AppUser?
    @State private var formUsername = ""
    @State private var formPassword = ""
    @State private var formDisplayName = ""
    @State private var formRole = "user"
    @State private var formActive = true

    private var theme: ThemeColors { themeColors(for: store.themeMode) }
    private var isDark: Bool { store.themeMode == .dark }
    private var isAdmin: Bool { store.currentUser?.isAdmin ?? false }

    private var totalAmount: Double { store.orders.reduce(0) { $0 + $1.total_with_vat } }

    private var statusCounts: [(OrderStatus, Int)] {
        OrderStatus.allCases.map { status in
            (status, store.orders.filter { $0.status == status }.count)
        }
    }

    var body: some View {
        ScrollView {
            VStack(spacing: 16) {
                // User banner
                userBanner

                // Appearance
                appearanceSection

                // Stats + Status
                VStack(spacing: 16) {
                    statsSection
                    statusSection
                }

                // User management
                if isAdmin {
                    userManagementSection
                }

                // Data management
                dataSection

                // Platform
                platformSection

                // Footer
                footer
            }
            .padding(.horizontal, 20)
            .padding(.top, 6)
            .padding(.bottom, 40)
        }
        .background(theme.background.ignoresSafeArea())
        .scrollIndicators(.hidden)
        .sheet(isPresented: $showUserModal) { userModal }
        .navigationTitle("Ajustes")
        .navigationBarTitleDisplayMode(.inline)
    }

    // MARK: - User banner

    private var userBanner: some View {
        HStack(spacing: 14) {
            Image(systemName: isAdmin ? "shield" : "person")
                .font(.system(size: 20))
                .foregroundStyle(.white)
                .frame(width: 48, height: 48)
                .background(isAdmin ? theme.primary : theme.textSecondary)
                .clipShape(.rect(cornerRadius: 15))

            VStack(alignment: .leading, spacing: 2) {
                Text(store.currentUser?.displayName ?? "")
                    .font(.system(size: 17, weight: .bold, design: .rounded))
                    .foregroundStyle(theme.text)
                if let email = store.currentUser?.email, !email.isEmpty {
                    Text(email)
                        .font(.system(size: 12))
                        .foregroundStyle(theme.textTertiary)
                        .lineLimit(1)
                }
                HStack(spacing: 6) {
                    Text(isAdmin ? "Administrador" : "Usuario")
                        .font(.system(size: 12, weight: .medium))
                        .foregroundStyle(theme.textSecondary)
                }
            }

            Spacer()

            Button {
                handleLogout()
            } label: {
                HStack(spacing: 6) {
                    Image(systemName: "arrow.right.square")
                        .font(.system(size: 14, weight: .medium))
                    Text("Salir")
                        .font(.system(size: 13, weight: .semibold))
                }
                .foregroundStyle(theme.error)
                .padding(.horizontal, 16)
                .padding(.vertical, 10)
                .background(theme.errorBg)
                .overlay(
                    .rect(cornerRadius: 12)
                        .stroke(theme.error.opacity(0.3), lineWidth: 1)
                )
                .clipShape(.rect(cornerRadius: 12))
            }
            .buttonStyle(.plain)
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

    // MARK: - Appearance

    private var appearanceSection: some View {
        VStack(alignment: .leading, spacing: 16) {
            HStack(spacing: 9) {
                Image(systemName: isDark ? "moon" : "sun.max")
                    .font(.system(size: 17))
                    .foregroundStyle(theme.primary)
                Text("Apariencia")
                    .font(.system(size: 18, weight: .heavy, design: .rounded))
                    .foregroundStyle(theme.text)
            }

            HStack(spacing: 12) {
                // Light option
                Button {
                    store.setTheme(.light)
                } label: {
                    VStack(spacing: 10) {
                        Image(systemName: "sun.max")
                            .font(.system(size: 18))
                            .foregroundStyle(store.themeMode == .light ? .white : theme.textTertiary)
                            .frame(width: 44, height: 44)
                            .background(store.themeMode == .light ? theme.primary : theme.surfaceAlt)
                            .clipShape(.rect(cornerRadius: 14))
                        Text("Claro")
                            .font(.system(size: 14, weight: .bold))
                            .foregroundStyle(store.themeMode == .light ? theme.primary : theme.textSecondary)
                    }
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 18)
                    .background(store.themeMode == .light ? theme.primarySoft : theme.surface)
                    .overlay(
                        .rect(cornerRadius: 16)
                            .stroke(store.themeMode == .light ? theme.primary : theme.border, lineWidth: 2)
                    )
                    .clipShape(.rect(cornerRadius: 16))
                }
                .buttonStyle(.plain)

                // Dark option
                Button {
                    store.setTheme(.dark)
                } label: {
                    VStack(spacing: 10) {
                        Image(systemName: "moon")
                            .font(.system(size: 18))
                            .foregroundStyle(store.themeMode == .dark ? .white : theme.textTertiary)
                            .frame(width: 44, height: 44)
                            .background(store.themeMode == .dark ? theme.primary : theme.surfaceAlt)
                            .clipShape(.rect(cornerRadius: 14))
                        Text("Oscuro")
                            .font(.system(size: 14, weight: .bold))
                            .foregroundStyle(store.themeMode == .dark ? theme.primary : theme.textSecondary)
                    }
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 18)
                    .background(store.themeMode == .dark ? theme.primarySoft : theme.surface)
                    .overlay(
                        .rect(cornerRadius: 16)
                            .stroke(store.themeMode == .dark ? theme.primary : theme.border, lineWidth: 2)
                    )
                    .clipShape(.rect(cornerRadius: 16))
                }
                .buttonStyle(.plain)
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

    // MARK: - Stats

    private var statsSection: some View {
        VStack(alignment: .leading, spacing: 0) {
            Text("Resumen")
                .font(.system(size: 18, weight: .heavy, design: .rounded))
                .foregroundStyle(theme.text)
                .padding(.bottom, 16)

            HStack(spacing: 10) {
                statCard(icon: "doc.text", value: "\(store.orders.count)", label: "Pedidos", bg: theme.primarySoft, iconBg: theme.primarySoftAlt, iconColor: theme.primary)
                statCard(icon: "building.2", value: "\(store.manufacturers.count)", label: "Fabricantes", bg: theme.accentSoft, iconBg: theme.accentSoft, iconColor: theme.accent)
                statCard(icon: "folder.open", value: "\(store.years.count)", label: "Años", bg: theme.primarySoft, iconBg: theme.primarySoftAlt, iconColor: theme.primaryLight)
            }

            // Total amount
            VStack(spacing: 6) {
                Text("FACTURACIÓN TOTAL")
                    .font(.system(size: 12, weight: .semibold))
                    .tracking(0.8)
                    .foregroundStyle(isDark ? theme.textTertiary : Color.white.opacity(0.55))
                Text(Calculations.formatCurrency(totalAmount))
                    .font(.system(size: 30, weight: .heavy, design: .rounded))
                    .foregroundStyle(isDark ? theme.primary : .white)
            }
            .frame(maxWidth: .infinity)
            .padding(20)
            .background(isDark ? theme.surfaceElevated : theme.primaryDark)
            .clipShape(.rect(cornerRadius: 16))
            .overlay(
                Group {
                    if isDark {
                        .rect(cornerRadius: 16).stroke(theme.border, lineWidth: 1)
                    }
                }
            )
            .padding(.top, 16)
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

    private func statCard(icon: String, value: String, label: String, bg: Color, iconBg: Color, iconColor: Color) -> some View {
        VStack(spacing: 6) {
            Image(systemName: icon)
                .font(.system(size: 19, weight: .semibold))
                .foregroundStyle(iconColor)
                .frame(width: 40, height: 40)
                .background(iconBg)
                .clipShape(.rect(cornerRadius: 12))
            Text(value)
                .font(.system(size: 24, weight: .heavy, design: .rounded))
                .foregroundStyle(theme.text)
            Text(label)
                .font(.system(size: 11, weight: .medium))
                .foregroundStyle(theme.textSecondary)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 16)
        .background(bg)
        .clipShape(.rect(cornerRadius: 16))
    }

    // MARK: - Status section

    private var statusSection: some View {
        VStack(alignment: .leading, spacing: 0) {
            Text("Estado de Pedidos")
                .font(.system(size: 18, weight: .heavy, design: .rounded))
                .foregroundStyle(theme.text)
                .padding(.bottom, 16)

            VStack(spacing: 10) {
                ForEach(statusCounts, id: \.0) { status, count in
                    let sc = statusColors(for: status, theme: theme)
                    HStack(spacing: 12) {
                        Image(systemName: status.sfSymbol)
                            .font(.system(size: 12))
                            .foregroundStyle(sc.text)
                            .frame(width: 32, height: 32)
                            .background(sc.bg)
                            .clipShape(.rect(cornerRadius: 10))
                        Text(status.label)
                            .font(.system(size: 14, weight: .medium))
                            .foregroundStyle(theme.text)
                        Spacer()
                        Text("\(count)")
                            .font(.system(size: 14, weight: .bold))
                            .foregroundStyle(theme.text)
                            .padding(.horizontal, 12)
                            .padding(.vertical, 5)
                            .background(theme.surfaceAlt)
                            .clipShape(.rect(cornerRadius: 9))
                    }
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
        .shadow(color: theme.cardShadow, radius: 8, y: 2)
    }

    // MARK: - User management

    private var userManagementSection: some View {
        VStack(alignment: .leading, spacing: 0) {
            HStack {
                HStack(spacing: 9) {
                    Image(systemName: "person.2")
                        .font(.system(size: 17))
                        .foregroundStyle(theme.primary)
                    Text("Gestión de Usuarios")
                        .font(.system(size: 18, weight: .heavy, design: .rounded))
                        .foregroundStyle(theme.text)
                }
                Spacer()
                Button {
                    editingUser = nil
                    formUsername = ""
                    formPassword = ""
                    formDisplayName = ""
                    formRole = "user"
                    formActive = true
                    showUserModal = true
                } label: {
                    HStack(spacing: 6) {
                        Image(systemName: "person.badge.plus")
                            .font(.system(size: 12, weight: .bold))
                        Text("Nuevo")
                            .font(.system(size: 13, weight: .semibold))
                    }
                    .foregroundStyle(.white)
                    .padding(.horizontal, 16)
                    .padding(.vertical, 9)
                    .background(theme.primary)
                    .clipShape(.rect(cornerRadius: 10))
                }
                .buttonStyle(.plain)
            }
            .padding(.bottom, 16)

            ForEach(store.users) { user in
                userRow(user)
                if user.id != store.users.last?.id {
                    Rectangle().fill(theme.divider).frame(height: 1)
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
        .shadow(color: theme.cardShadow, radius: 8, y: 2)
    }

    private func userRow(_ user: AppUser) -> some View {
        HStack(spacing: 12) {
            Image(systemName: user.isAdmin ? "shield" : "person")
                .font(.system(size: 13))
                .foregroundStyle(.white)
                .frame(width: 34, height: 34)
                .background(user.isAdmin ? theme.primary : theme.textSecondary)
                .clipShape(.rect(cornerRadius: 10))

            VStack(alignment: .leading, spacing: 2) {
                Text(user.displayName)
                    .font(.system(size: 14, weight: .semibold))
                    .foregroundStyle(theme.text)
                Text(user.authProvider == "google" ? user.email : "@\(user.username)")
                    .font(.system(size: 12, design: .monospaced))
                    .foregroundStyle(theme.textTertiary)

                HStack(spacing: 6) {
                    Text(user.isAdmin ? "Admin" : "Usuario")
                        .font(.system(size: 11, weight: .semibold))
                        .foregroundStyle(user.isAdmin ? theme.primary : theme.textSecondary)
                        .padding(.horizontal, 9)
                        .padding(.vertical, 3)
                        .background(user.isAdmin ? theme.primarySoft : theme.surfaceAlt)
                        .clipShape(.rect(cornerRadius: 7))

                    if !user.active {
                        Text("Inactivo")
                            .font(.system(size: 11, weight: .semibold))
                            .foregroundStyle(theme.error)
                            .padding(.horizontal, 9)
                            .padding(.vertical, 3)
                            .background(theme.errorBg)
                            .clipShape(.rect(cornerRadius: 7))
                    }
                }
                .padding(.top, 3)
            }

            Spacer()

            HStack(spacing: 6) {
                Button {
                    editingUser = user
                    formUsername = user.username
                    formPassword = ""
                    formDisplayName = user.displayName
                    formRole = user.role
                    formActive = user.active
                    showUserModal = true
                } label: {
                    Image(systemName: "pencil")
                        .font(.system(size: 13, weight: .medium))
                        .foregroundStyle(theme.textSecondary)
                        .frame(width: 34, height: 34)
                        .background(theme.surfaceAlt)
                        .clipShape(.rect(cornerRadius: 9))
                }
                .buttonStyle(.plain)

                if user.id != UUID(uuidString: "00000000-0000-0000-0000-0000000000AA")! && user.id != store.currentUser?.id {
                    Button {
                        handleDeleteUser(user)
                    } label: {
                        Image(systemName: "trash")
                            .font(.system(size: 13, weight: .medium))
                            .foregroundStyle(theme.error)
                            .frame(width: 34, height: 34)
                            .background(theme.errorBg)
                            .clipShape(.rect(cornerRadius: 9))
                    }
                    .buttonStyle(.plain)
                }
            }
        }
        .padding(.vertical, 14)
    }

    // MARK: - Data section

    private var dataSection: some View {
        VStack(alignment: .leading, spacing: 0) {
            Text("Datos")
                .font(.system(size: 18, weight: .heavy, design: .rounded))
                .foregroundStyle(theme.text)
                .padding(.bottom, 16)

            if isAdmin {
                Button {
                    handleResetData()
                } label: {
                    HStack(spacing: 14) {
                        Image(systemName: "arrow.counterclockwise")
                            .font(.system(size: 17, weight: .medium))
                            .foregroundStyle(theme.primary)
                            .frame(width: 40, height: 40)
                            .background(theme.primarySoft)
                            .clipShape(.rect(cornerRadius: 12))
                        VStack(alignment: .leading, spacing: 2) {
                            Text("Restaurar datos de ejemplo")
                                .font(.system(size: 15, weight: .semibold))
                                .foregroundStyle(theme.text)
                            Text("Restaura los datos de muestra originales")
                                .font(.system(size: 12))
                                .foregroundStyle(theme.textSecondary)
                        }
                        Spacer()
                    }
                }
                .buttonStyle(.plain)
                .padding(.bottom, 14)
                .overlay(
                    Rectangle().fill(theme.divider).frame(height: 1),
                    alignment: .bottom
                )

                Button {
                    handleClearAll()
                } label: {
                    HStack(spacing: 14) {
                        Image(systemName: "trash")
                            .font(.system(size: 17, weight: .medium))
                            .foregroundStyle(theme.error)
                            .frame(width: 40, height: 40)
                            .background(theme.errorBg)
                            .clipShape(.rect(cornerRadius: 12))
                        VStack(alignment: .leading, spacing: 2) {
                            Text("Eliminar todos los datos")
                                .font(.system(size: 15, weight: .semibold))
                                .foregroundStyle(theme.error)
                            Text("Borra todos los pedidos, fabricantes y años")
                                .font(.system(size: 12))
                                .foregroundStyle(theme.textSecondary)
                        }
                        Spacer()
                    }
                }
                .buttonStyle(.plain)
            } else {
                Text("Solo los administradores pueden gestionar los datos")
                    .font(.system(size: 13))
                    .italic()
                    .foregroundStyle(theme.textTertiary)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 18)
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

    // MARK: - Platform

    private var platformSection: some View {
        VStack(alignment: .leading, spacing: 0) {
            HStack(spacing: 9) {
                Image(systemName: "desktopcomputer")
                    .font(.system(size: 17))
                    .foregroundStyle(theme.primary)
                Text("Plataforma")
                    .font(.system(size: 18, weight: .heavy, design: .rounded))
                    .foregroundStyle(theme.text)
            }
            .padding(.bottom, 14)

            VStack(alignment: .leading, spacing: 3) {
                Text("iOS")
                    .font(.system(size: 14, weight: .semibold))
                    .foregroundStyle(theme.text)
                Text("Aplicación nativa móvil")
                    .font(.system(size: 12))
                    .foregroundStyle(theme.textSecondary)
            }
            .padding(16)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(theme.surfaceAlt)
            .clipShape(.rect(cornerRadius: 14))
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

    // MARK: - Footer

    private var footer: some View {
        VStack(spacing: 6) {
            HStack(spacing: 6) {
                Image(systemName: "info.circle")
                    .font(.system(size: 14))
                    .foregroundStyle(theme.textTertiary)
                Text("Flow v1.0")
                    .font(.system(size: 14, weight: .bold))
                    .foregroundStyle(theme.textSecondary)
            }
            Text("Pedidos en movimiento · Multiplataforma")
                .font(.system(size: 12))
                .foregroundStyle(theme.textTertiary)
        }
        .padding(.vertical, 28)
    }

    // MARK: - User modal

    private var userModal: some View {
        VStack(spacing: 0) {
            HStack {
                Text(editingUser != nil ? "Editar Usuario" : "Crear Usuario")
                    .font(.system(size: 21, weight: .heavy, design: .rounded))
                    .foregroundStyle(theme.text)
                Spacer()
                Button {
                    showUserModal = false
                } label: {
                    Image(systemName: "xmark")
                        .font(.system(size: 20))
                        .foregroundStyle(theme.textSecondary)
                }
                .buttonStyle(.plain)
            }
            .padding(.bottom, 20)

            modalField("Nombre de usuario *", text: $formUsername, placeholder: "usuario")
            modalField(editingUser != nil ? "Nueva contraseña (dejar vacío para no cambiar)" : "Contraseña *", text: $formPassword, placeholder: "••••••", secure: true)
            modalField("Nombre visible *", text: $formDisplayName, placeholder: "Nombre completo")

            // Role selector
            VStack(alignment: .leading, spacing: 7) {
                Text("ROL")
                    .font(.system(size: 12, weight: .semibold))
                    .tracking(0.5)
                    .foregroundStyle(theme.textSecondary)
                HStack(spacing: 10) {
                    Button { formRole = "admin" } label: {
                        HStack(spacing: 7) {
                            Image(systemName: "shield")
                                .font(.system(size: 13, weight: .semibold))
                            Text("Admin")
                                .font(.system(size: 14, weight: .semibold))
                        }
                        .foregroundStyle(formRole == "admin" ? .white : theme.textSecondary)
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 13)
                        .background(formRole == "admin" ? theme.primary : theme.surface)
                        .overlay(
                            .rect(cornerRadius: 12)
                                .stroke(formRole == "admin" ? theme.primary : theme.border, lineWidth: 2)
                        )
                        .clipShape(.rect(cornerRadius: 12))
                    }
                    .buttonStyle(.plain)

                    Button { formRole = "user" } label: {
                        HStack(spacing: 7) {
                            Image(systemName: "person")
                                .font(.system(size: 13, weight: .semibold))
                            Text("Usuario")
                                .font(.system(size: 14, weight: .semibold))
                        }
                        .foregroundStyle(formRole == "user" ? .white : theme.textSecondary)
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 13)
                        .background(formRole == "user" ? theme.primary : theme.surface)
                        .overlay(
                            .rect(cornerRadius: 12)
                                .stroke(formRole == "user" ? theme.primary : theme.border, lineWidth: 2)
                        )
                        .clipShape(.rect(cornerRadius: 12))
                    }
                    .buttonStyle(.plain)
                }
            }
            .padding(.bottom, 16)

            if editingUser != nil {
                HStack {
                    Text("Cuenta activa")
                        .font(.system(size: 14, weight: .semibold))
                        .foregroundStyle(theme.text)
                    Spacer()
                    Toggle("", isOn: $formActive)
                        .tint(theme.primary)
                }
                .padding(.bottom, 8)
            }

            Spacer(minLength: 12)

            HStack(spacing: 12) {
                Button("Cancelar") { showUserModal = false }
                    .font(.system(size: 14, weight: .semibold))
                    .foregroundStyle(theme.textSecondary)
                    .padding(.horizontal, 22)
                    .padding(.vertical, 12)
                    .overlay(
                        .rect(cornerRadius: 12)
                            .stroke(theme.border, lineWidth: 1)
                    )
                    .clipShape(.rect(cornerRadius: 12))

                Button(editingUser != nil ? "Actualizar" : "Crear") { handleSaveUser() }
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
        .padding(28)
        .background(theme.surface)
        .clipShape(.rect(cornerRadius: 24))
        .frame(maxWidth: 440)
    }

    private func modalField(_ label: String, text: Binding<String>, placeholder: String, secure: Bool = false) -> some View {
        VStack(alignment: .leading, spacing: 7) {
            Text(label.uppercased())
                .font(.system(size: 12, weight: .semibold))
                .tracking(0.5)
                .foregroundStyle(theme.textSecondary)
            if secure {
                SecureField("", text: text, prompt: Text(placeholder).foregroundColor(theme.textTertiary))
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
            } else {
                TextField("", text: text, prompt: Text(placeholder).foregroundColor(theme.textTertiary))
                    .font(.system(size: 15))
                    .foregroundStyle(theme.text)
                    .textInputAutocapitalization(.none)
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
        .padding(.bottom, 16)
    }

    // MARK: - Actions

    private func handleLogout() {
        let alert = UIAlertController(title: "Cerrar Sesión", message: "¿Estás seguro de que quieres salir?", preferredStyle: .alert)
        alert.addAction(UIAlertAction(title: "Cancelar", style: .cancel))
        alert.addAction(UIAlertAction(title: "Salir", style: .destructive) { _ in
            store.logout()
        })
        UIApplication.shared.topVC()?.present(alert, animated: true)
    }

    private func handleResetData() {
        let alert = UIAlertController(title: "¿Restaurar datos de ejemplo?", message: "Se eliminarán todos los datos actuales y se restaurarán los datos de muestra.", preferredStyle: .alert)
        alert.addAction(UIAlertAction(title: "Cancelar", style: .cancel))
        alert.addAction(UIAlertAction(title: "Restaurar", style: .destructive) { _ in
            store.resetData()
        })
        UIApplication.shared.topVC()?.present(alert, animated: true)
    }

    private func handleClearAll() {
        let alert = UIAlertController(title: "¿Eliminar todos los datos?", message: "Esta acción no se puede deshacer.", preferredStyle: .alert)
        alert.addAction(UIAlertAction(title: "Cancelar", style: .cancel))
        alert.addAction(UIAlertAction(title: "Eliminar todo", style: .destructive) { _ in
            store.clearAllData()
        })
        UIApplication.shared.topVC()?.present(alert, animated: true)
    }

    private func handleDeleteUser(_ user: AppUser) {
        let alert = UIAlertController(title: "¿Eliminar usuario?", message: "Se eliminará \"\(user.displayName)\" permanentemente.", preferredStyle: .alert)
        alert.addAction(UIAlertAction(title: "Cancelar", style: .cancel))
        alert.addAction(UIAlertAction(title: "Eliminar", style: .destructive) { _ in
            _ = store.deleteUser(user.id)
        })
        UIApplication.shared.topVC()?.present(alert, animated: true)
    }

    private func handleSaveUser() {
        guard !formUsername.trimmingCharacters(in: .whitespaces).isEmpty,
              !formDisplayName.trimmingCharacters(in: .whitespaces).isEmpty else { return }

        if let editingUser {
            _ = store.updateUser(
                editingUser.id,
                username: formUsername.trimmingCharacters(in: .whitespaces),
                password: formPassword.isEmpty ? nil : formPassword,
                displayName: formDisplayName.trimmingCharacters(in: .whitespaces),
                role: formRole,
                active: formActive
            )
        } else {
            guard !formPassword.isEmpty else { return }
            _ = store.addUser(
                username: formUsername.trimmingCharacters(in: .whitespaces),
                password: formPassword,
                displayName: formDisplayName.trimmingCharacters(in: .whitespaces),
                role: formRole
            )
        }
        showUserModal = false
    }
}
