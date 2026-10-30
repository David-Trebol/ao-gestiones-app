import SwiftUI

struct LoginView: View {
    @Environment(AppStore.self) private var store
    @State private var username = ""
    @State private var password = ""
    @State private var showPassword = false
    @State private var error = ""
    @State private var loading = false
    @State private var showCredentials = false

    var body: some View {
        ZStack {
            LinearGradient(
                colors: [Color(red: 0x0A/255, green: 0x0A/255, blue: 0x0F/255),
                         Color(red: 0x14/255, green: 0x14/255, blue: 0x19/255)],
                startPoint: .top, endPoint: .bottom
            )
            .ignoresSafeArea()

            // Glow orbs
            Circle()
                .fill(Color(red: 0xFF/255, green: 0x4D/255, blue: 0x2D/255).opacity(0.12))
                .frame(width: 280, height: 280)
                .blur(radius: 60)
                .offset(x: 80, y: -180)

            Circle()
                .fill(Color(red: 0x60/255, green: 0xA5/255, blue: 0xFA/255).opacity(0.06))
                .frame(width: 200, height: 200)
                .blur(radius: 50)
                .offset(x: -100, y: 200)

            VStack(spacing: 0) {
                Spacer()

                // Logo section
                VStack(spacing: 16) {
                    ZStack {
                        RoundedRectangle(cornerRadius: 22)
                            .fill(Color(red: 0xFF/255, green: 0x4D/255, blue: 0x2D/255))
                            .frame(width: 72, height: 72)
                            .shadow(color: Color(red: 0xFF/255, green: 0x4D/255, blue: 0x2D/255).opacity(0.5), radius: 20, y: 8)

                        Image(systemName: "bolt.fill")
                            .font(.system(size: 28))
                            .foregroundStyle(.white)
                    }
                    .overlay {
                        RoundedRectangle(cornerRadius: 30)
                            .stroke(Color(red: 0xFF/255, green: 0x4D/255, blue: 0x2D/255).opacity(0.2), lineWidth: 1.5)
                            .frame(width: 88, height: 88)
                            .offset(y: 0)
                    }

                    Text("Flow")
                        .font(.system(size: 38, weight: .black, design: .rounded))
                        .foregroundStyle(.white)
                        .tracking(-1.5)

                    Text("Pedidos en movimiento")
                        .font(.system(size: 14, weight: .medium))
                        .foregroundStyle(Color(red: 0x95/255, green: 0x95/255, blue: 0xA5/255))
                        .textCase(.uppercase)
                        .tracking(2)
                }

                // Form card
                VStack(alignment: .leading, spacing: 0) {
                    VStack(alignment: .leading, spacing: 4) {
                        Text("Bienvenido")
                            .font(.system(size: 24, weight: .heavy, design: .rounded))
                            .foregroundStyle(.white)
                        Text("Inicia sesión para continuar")
                            .font(.system(size: 14))
                            .foregroundStyle(Color(red: 0x6B/255, green: 0x6B/255, blue: 0x7B/255))
                    }
                    .padding(.bottom, 24)

                    if !error.isEmpty {
                        HStack(spacing: 10) {
                            Circle()
                                .fill(Color(red: 0xFF/255, green: 0x4D/255, blue: 0x2D/255))
                                .frame(width: 6, height: 6)
                            Text(error)
                                .font(.system(size: 13, weight: .semibold))
                                .foregroundStyle(Color(red: 0xFF/255, green: 0x4D/255, blue: 0x2D/255))
                        }
                        .padding(14)
                        .background(Color(red: 0xFF/255, green: 0x4D/255, blue: 0x2D/255).opacity(0.08))
                        .overlay(
                            .rect(cornerRadius: 12)
                                .stroke(Color(red: 0xFF/255, green: 0x4D/255, blue: 0x2D/255).opacity(0.2), lineWidth: 1)
                        )
                        .clipShape(.rect(cornerRadius: 12))
                        .padding(.bottom, 18)
                    }

                    // Username field
                    VStack(alignment: .leading, spacing: 8) {
                        Text("Usuario")
                            .font(.system(size: 12, weight: .semibold))
                            .foregroundStyle(Color(red: 0x95/255, green: 0x95/255, blue: 0xA5/255))
                        TextField("", text: $username, prompt: Text("Tu nombre de usuario").foregroundColor(Color(red: 0x6B/255, green: 0x6B/255, blue: 0x7B/255)))
                            .font(.system(size: 15))
                            .foregroundStyle(.white)
                            .textInputAutocapitalization(.none)
                            .autocorrectionDisabled()
                            .padding(.horizontal, 16)
                            .padding(.vertical, 14)
                            .background(Color(red: 0x1C/255, green: 0x1C/255, blue: 0x24/255))
                            .overlay(
                                .rect(cornerRadius: 14)
                                    .stroke(Color(red: 0x2A/255, green: 0x2A/255, blue: 0x35/255), lineWidth: 1.5)
                            )
                            .clipShape(.rect(cornerRadius: 14))
                    }
                    .padding(.bottom, 16)

                    // Password field
                    VStack(alignment: .leading, spacing: 8) {
                        Text("Contraseña")
                            .font(.system(size: 12, weight: .semibold))
                            .foregroundStyle(Color(red: 0x95/255, green: 0x95/255, blue: 0xA5/255))
                        HStack {
                            Group {
                                if showPassword {
                                    TextField("", text: $password, prompt: Text("Tu contraseña").foregroundColor(Color(red: 0x6B/255, green: 0x6B/255, blue: 0x7B/255)))
                                        .font(.system(size: 15))
                                        .foregroundStyle(.white)
                                        .textInputAutocapitalization(.none)
                                        .autocorrectionDisabled()
                                } else {
                                    SecureField("", text: $password, prompt: Text("Tu contraseña").foregroundColor(Color(red: 0x6B/255, green: 0x6B/255, blue: 0x7B/255)))
                                        .font(.system(size: 15))
                                        .foregroundStyle(.white)
                                        .textInputAutocapitalization(.none)
                                        .autocorrectionDisabled()
                                }
                            }
                            Button {
                                showPassword.toggle()
                            } label: {
                                Image(systemName: showPassword ? "eye.slash" : "eye")
                                    .font(.system(size: 14))
                                    .foregroundStyle(Color(red: 0x6B/255, green: 0x6B/255, blue: 0x7B/255))
                                    .padding(.trailing, 14)
                                    .padding(.leading, 4)
                            }
                            .buttonStyle(.plain)
                        }
                        .padding(.horizontal, 16)
                        .padding(.vertical, 14)
                        .background(Color(red: 0x1C/255, green: 0x1C/255, blue: 0x24/255))
                        .overlay(
                            .rect(cornerRadius: 14)
                                .stroke(Color(red: 0x2A/255, green: 0x2A/255, blue: 0x35/255), lineWidth: 1.5)
                        )
                        .clipShape(.rect(cornerRadius: 14))
                    }
                    .padding(.bottom, 20)

                    // Login button
                    Button {
                        handleLogin()
                    } label: {
                        HStack(spacing: 10) {
                            if loading {
                                ProgressView()
                                    .tint(.white)
                            } else {
                                Text("Entrar")
                                    .font(.system(size: 16, weight: .bold))
                                Image(systemName: "arrow.right")
                                    .font(.system(size: 16, weight: .semibold))
                            }
                        }
                        .foregroundStyle(.white)
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 16)
                        .background(Color(red: 0xFF/255, green: 0x4D/255, blue: 0x2D/255))
                        .clipShape(.rect(cornerRadius: 14))
                        .shadow(color: Color(red: 0xFF/255, green: 0x4D/255, blue: 0x2D/255).opacity(0.4), radius: 14, y: 6)
                    }
                    .buttonStyle(.plain)
                    .disabled(loading)
                    .opacity(loading ? 0.6 : 1)

                    // Credential hint
                    Button {
                        withAnimation { showCredentials.toggle() }
                    } label: {
                        HStack(spacing: 6) {
                            Image(systemName: "envelope")
                                .font(.system(size: 12))
                            Text(showCredentials ? "Ocultar credenciales" : "Credenciales de prueba")
                                .font(.system(size: 12, weight: .medium))
                        }
                        .foregroundStyle(Color(red: 0x6B/255, green: 0x6B/255, blue: 0x7B/255))
                    }
                    .buttonStyle(.plain)
                    .padding(.top, 20)

                    if showCredentials {
                        VStack(spacing: 10) {
                            HStack {
                                Text("Usuario")
                                    .font(.system(size: 12, weight: .medium))
                                    .foregroundStyle(Color(red: 0x6B/255, green: 0x6B/255, blue: 0x7B/255))
                                Spacer()
                                Text("admin")
                                    .font(.system(size: 13, weight: .bold, design: .monospaced))
                                    .foregroundStyle(Color(red: 0xFF/255, green: 0x4D/255, blue: 0x2D/255))
                            }
                            Rectangle()
                                .fill(Color(red: 0x2A/255, green: 0x2A/255, blue: 0x35/255))
                                .frame(height: 1)
                            HStack {
                                Text("Contraseña")
                                    .font(.system(size: 12, weight: .medium))
                                    .foregroundStyle(Color(red: 0x6B/255, green: 0x6B/255, blue: 0x7B/255))
                                Spacer()
                                Text("admin123")
                                    .font(.system(size: 13, weight: .bold, design: .monospaced))
                                    .foregroundStyle(Color(red: 0xFF/255, green: 0x4D/255, blue: 0x2D/255))
                            }
                        }
                        .padding(16)
                        .background(Color(red: 0x1C/255, green: 0x1C/255, blue: 0x24/255))
                        .overlay(
                            .rect(cornerRadius: 12)
                                .stroke(Color(red: 0x2A/255, green: 0x2A/255, blue: 0x35/255), lineWidth: 1)
                        )
                        .clipShape(.rect(cornerRadius: 12))
                        .padding(.top, 12)
                        .transition(.opacity.combined(with: .scale(scale: 0.9)))
                    }
                }
                .padding(28)
                .background(Color(red: 0x14/255, green: 0x14/255, blue: 0x19/255))
                .overlay(
                    .rect(cornerRadius: 24)
                        .stroke(Color(red: 0x2A/255, green: 0x2A/255, blue: 0x35/255), lineWidth: 1)
                )
                .clipShape(.rect(cornerRadius: 24))
                .padding(.top, 36)

                Text("Flow v1.0")
                    .font(.system(size: 11))
                    .foregroundStyle(Color(red: 0x2A/255, green: 0x2A/255, blue: 0x35/255))
                    .padding(.top, 28)

                Spacer()
            }
            .padding(.horizontal, 24)
            .frame(maxWidth: 400)
        }
    }

    private func handleLogin() {
        guard !username.trimmingCharacters(in: .whitespaces).isEmpty,
              !password.trimmingCharacters(in: .whitespaces).isEmpty else {
            withAnimation { error = "Introduce usuario y contraseña" }
            return
        }

        loading = true
        error = ""

        DispatchQueue.main.asyncAfter(deadline: .now() + 0.3) {
            let success = store.login(username: username.trimmingCharacters(in: .whitespaces), password: password)
            if !success {
                withAnimation { error = "Usuario o contraseña incorrectos" }
            }
            loading = false
        }
    }
}
