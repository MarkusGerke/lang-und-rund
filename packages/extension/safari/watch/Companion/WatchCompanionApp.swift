import SwiftUI

@main
struct WatchCompanionApp: App {
  var body: some Scene {
    WindowGroup {
      ContentView()
    }
  }
}

struct ContentView: View {
  var body: some View {
    ScrollView {
      VStack(alignment: .leading, spacing: 14) {
        Text("lang & rund")
          .font(.largeTitle.weight(.semibold))
        Text("Watch-Begleit-App")
          .font(.title3)
          .foregroundStyle(.secondary)

        Text("Installation auf die Watch")
          .font(.headline)
          .padding(.top, 8)

        Text(
          "Nicht über die Watch-App auf dem iPhone „Installieren“ tippen — bei Entwicklungsbuilds schlägt das oft still fehl (Kreis → wieder Installieren)."
        )
        .font(.body)

        Text("Stattdessen in Xcode:")
          .font(.body.weight(.semibold))
        Text(
          "1. Scheme „LangUndRundWatch“\n2. Ziel: dieses iPhone\n3. ▶ Run\n4. Auf der Watch Entwicklermodus an\n5. App-Raster der Watch prüfen"
        )
        .font(.body)

        Text(
          "Kostenloses Personal Team: Watch-Apps lassen sich oft nicht dauerhaft auf dem Gerät installieren — dann hilft ein bezahltes Apple-Developer-Programm."
        )
        .font(.footnote)
        .foregroundStyle(.secondary)
        .padding(.top, 8)
      }
      .frame(maxWidth: .infinity, alignment: .leading)
      .padding()
    }
  }
}

#Preview {
  ContentView()
}
