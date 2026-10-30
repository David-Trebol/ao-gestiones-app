import SwiftUI

struct ContentView: View {
    @Environment(AppStore.self) private var store

    var body: some View {
        Group {
            if store.currentUser == nil {
                LoginView()
            } else {
                MainTabView()
            }
        }
        .tint(themeColors(for: store.themeMode).primary)
    }
}

struct MainTabView: View {
    @Environment(AppStore.self) private var store
    @State private var selectedTab = 0
    @State private var homeView: HomeNavView = .years
    @State private var selectedYear: Int?
    @State private var selectedManufacturer: Manufacturer?

    private var theme: ThemeColors { themeColors(for: store.themeMode) }

    var body: some View {
        TabView(selection: $selectedTab) {
            // Home / Orders
            NavigationStack {
                HomeView(
                    currentView: $homeView,
                    selectedYear: $selectedYear,
                    selectedManufacturer: $selectedManufacturer
                )
            }
            .tabItem {
                Image(systemName: "folder.open")
                Text("Pedidos")
            }
            .tag(0)

            // Search
            NavigationStack {
                SearchView()
            }
            .tabItem {
                Image(systemName: "magnifyingglass")
                Text("Buscar")
            }
            .tag(1)

            // Manufacturers
            NavigationStack {
                ManufacturersView()
            }
            .tabItem {
                Image(systemName: "building.2")
                Text("Fabricantes")
            }
            .tag(2)

            // Settings
            NavigationStack {
                SettingsView()
            }
            .tabItem {
                Image(systemName: "gearshape")
                Text("Ajustes")
            }
            .tag(3)
        }
        .tint(theme.primary)
        .preferredColorScheme(store.themeMode == .dark ? .dark : .light)
    }
}
