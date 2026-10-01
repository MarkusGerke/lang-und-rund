import SwiftUI
#if canImport(UIKit)
import UIKit
#endif

enum ClockAppearanceStore {
  static let foregroundKey = "clock.foregroundHex"
  static let backgroundKey = "clock.backgroundHex"
  static let defaultForegroundHex = "FFFFFFFF"
  static let defaultBackgroundHex = "000000FF"
}

extension Color {
  /// Speichert als RRGGBBAA (0–255 Hex), für `@AppStorage` auf der Watch.
  init(hexRGBA: String) {
    let cleaned = hexRGBA.trimmingCharacters(in: CharacterSet.alphanumerics.inverted)
    var value: UInt64 = 0
    Scanner(string: cleaned).scanHexInt64(&value)
    let hasAlpha = cleaned.count >= 8
    let r, g, b, a: Double
    if hasAlpha {
      r = Double((value >> 24) & 0xFF) / 255
      g = Double((value >> 16) & 0xFF) / 255
      b = Double((value >> 8) & 0xFF) / 255
      a = Double(value & 0xFF) / 255
    } else {
      r = Double((value >> 16) & 0xFF) / 255
      g = Double((value >> 8) & 0xFF) / 255
      b = Double(value & 0xFF) / 255
      a = 1
    }
    self.init(.sRGB, red: r, green: g, blue: b, opacity: a)
  }

  func hexRGBA() -> String {
    let c = rgbaComponents()
    let ri = Int(round(c.r * 255))
    let gi = Int(round(c.g * 255))
    let bi = Int(round(c.b * 255))
    let ai = Int(round(c.a * 255))
    return String(format: "%02X%02X%02X%02X", ri, gi, bi, ai)
  }

  func rgbaComponents() -> (r: Double, g: Double, b: Double, a: Double) {
    #if canImport(UIKit)
    let ui = UIColor(self)
    var r: CGFloat = 0, g: CGFloat = 0, b: CGFloat = 0, a: CGFloat = 0
    if ui.getRed(&r, green: &g, blue: &b, alpha: &a) {
      return (Double(r), Double(g), Double(b), Double(a))
    }
    // Grau / andere Farbräume
    var w: CGFloat = 0
    if ui.getWhite(&w, alpha: &a) {
      return (Double(w), Double(w), Double(w), Double(a))
    }
    #endif
    return (1, 1, 1, 1)
  }

  static func srgb(r: Double, g: Double, b: Double) -> Color {
    Color(.sRGB, red: r, green: g, blue: b, opacity: 1)
  }
}

/// Schnellauswahl aus Systemfarben (watchOS hat keinen ColorPicker).
enum ClockSwatch: String, CaseIterable, Identifiable {
  case black, white, gray, red, orange, yellow, green, mint, teal, cyan, blue, indigo, purple, pink, brown

  var id: String { rawValue }

  var color: Color {
    switch self {
    case .black: return .black
    case .white: return .white
    case .gray: return .gray
    case .red: return .red
    case .orange: return .orange
    case .yellow: return .yellow
    case .green: return .green
    case .mint: return .mint
    case .teal: return .teal
    case .cyan: return .cyan
    case .blue: return .blue
    case .indigo: return .indigo
    case .purple: return .purple
    case .pink: return .pink
    case .brown: return .brown
    }
  }

  var label: String {
    switch self {
    case .black: return "Schwarz"
    case .white: return "Weiß"
    case .gray: return "Grau"
    case .red: return "Rot"
    case .orange: return "Orange"
    case .yellow: return "Gelb"
    case .green: return "Grün"
    case .mint: return "Mint"
    case .teal: return "Teal"
    case .cyan: return "Cyan"
    case .blue: return "Blau"
    case .indigo: return "Indigo"
    case .purple: return "Lila"
    case .pink: return "Rosa"
    case .brown: return "Braun"
    }
  }
}

private enum ColorTarget: String, CaseIterable, Identifiable {
  case foreground
  case background

  var id: String { rawValue }

  var label: String {
    switch self {
    case .foreground: return "Schrift"
    case .background: return "Hintergrund"
    }
  }
}

struct ClockColorSettingsView: View {
  @Binding var foreground: Color
  @Binding var background: Color
  var onDone: () -> Void

  @State private var target: ColorTarget = .foreground
  @State private var red: Double = 1
  @State private var green: Double = 1
  @State private var blue: Double = 1

  private var activeColor: Binding<Color> {
    switch target {
    case .foreground: return $foreground
    case .background: return $background
    }
  }

  var body: some View {
    NavigationStack {
      Form {
        Section {
          Picker("Farbe für", selection: $target) {
            ForEach(ColorTarget.allCases) { t in
              Text(t.label).tag(t)
            }
          }
          .onChange(of: target) { _, _ in syncSlidersFromActive() }
        }

        Section("Vorschau") {
          ZStack {
            RoundedRectangle(cornerRadius: 12, style: .continuous)
              .fill(background)
              .frame(height: 52)
            Text("Aa")
              .font(.custom(ScriptMode.fraktur.fontName, size: 28))
              .foregroundStyle(foreground)
          }
          .listRowBackground(Color.clear)
          .listRowInsets(EdgeInsets(top: 4, leading: 0, bottom: 4, trailing: 0))
        }

        Section("Palette") {
          LazyVGrid(columns: [GridItem(.adaptive(minimum: 36), spacing: 8)], spacing: 8) {
            ForEach(ClockSwatch.allCases) { swatch in
              Button {
                apply(swatch.color)
              } label: {
                Circle()
                  .fill(swatch.color)
                  .frame(width: 32, height: 32)
                  .overlay(
                    Circle()
                      .strokeBorder(Color.primary.opacity(0.35), lineWidth: 1)
                  )
                  .accessibilityLabel(swatch.label)
              }
              .buttonStyle(.plain)
            }
          }
          .padding(.vertical, 4)
        }

        Section("RGB (Digital Crown)") {
          labeledSlider("R", value: $red, tint: .red)
          labeledSlider("G", value: $green, tint: .green)
          labeledSlider("B", value: $blue, tint: .blue)
        }

        Section {
          Button("Zurücksetzen") {
            foreground = Color(hexRGBA: ClockAppearanceStore.defaultForegroundHex)
            background = Color(hexRGBA: ClockAppearanceStore.defaultBackgroundHex)
            syncSlidersFromActive()
          }
        }
      }
      .navigationTitle("Farben")
      .toolbar {
        ToolbarItem(placement: .confirmationAction) {
          Button("Fertig") { onDone() }
        }
      }
      .onAppear(perform: syncSlidersFromActive)
      .onChange(of: red) { _, _ in pushSlidersToActive() }
      .onChange(of: green) { _, _ in pushSlidersToActive() }
      .onChange(of: blue) { _, _ in pushSlidersToActive() }
    }
  }

  private func labeledSlider(_ title: String, value: Binding<Double>, tint: Color) -> some View {
    VStack(alignment: .leading, spacing: 2) {
      HStack {
        Text(title)
        Spacer()
        Text("\(Int(round(value.wrappedValue * 255)))")
          .foregroundStyle(.secondary)
          .monospacedDigit()
      }
      Slider(value: value, in: 0...1)
        .tint(tint)
    }
  }

  private func syncSlidersFromActive() {
    let c = activeColor.wrappedValue.rgbaComponents()
    red = c.r
    green = c.g
    blue = c.b
  }

  private func pushSlidersToActive() {
    activeColor.wrappedValue = Color.srgb(r: red, g: green, b: blue)
  }

  private func apply(_ color: Color) {
    activeColor.wrappedValue = color
    syncSlidersFromActive()
  }
}
