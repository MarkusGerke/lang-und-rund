import SwiftUI
#if os(watchOS)
import WatchKit
#endif

/// Schriftarten für das Ziffernblatt (Fraktur + Sütterlin).
enum ClockScript: String, CaseIterable, Identifiable {
  case fraktur
  case suetterlin

  var id: String { rawValue }

  var fontName: String {
    switch self {
    case .fraktur: return ScriptMode.fraktur.fontName
    case .suetterlin: return ScriptMode.suetterlin.fontName
    }
  }

  /// Handschrift wirkt kleiner — etwas größer setzen.
  var sizeScale: CGFloat {
    switch self {
    case .fraktur: return 1
    case .suetterlin: return 1.35
    }
  }

  var accessibilityName: String {
    switch self {
    case .fraktur: return "Fraktur"
    case .suetterlin: return "Sütterlin"
    }
  }
}

struct ClockLayout {
  let hourLines: [String]
  let minuteLines: [String]

  var lineCount: Int {
    hourLines.count + 1 + minuteLines.count
  }
}

enum ClockWordLayout {
  /// Bricht Komposita nach „und“ (auch mit ſ / Sütterlin-s): …und|zwanzig.
  static func lines(for word: String) -> [String] {
    guard let und = word.range(of: "und"), und.upperBound < word.endIndex else {
      return [word]
    }
    let head = String(word[..<und.upperBound])
    let tail = String(word[und.upperBound...])
    guard !tail.isEmpty else { return [word] }
    return [head, tail]
  }

  static func layout(hour: Int, minute: Int, script: ClockScript) -> ClockLayout {
    let hourWord: String
    let minuteWord: String
    switch script {
    case .fraktur:
      hourWord = ClockNumberWords.hourFrakturWord(hour)
      minuteWord = ClockNumberWords.minuteFrakturWord(minute)
    case .suetterlin:
      hourWord = ClockNumberWords.hourSuetterlinWord(hour)
      minuteWord = ClockNumberWords.minuteSuetterlinWord(minute)
    }
    let hourLines = lines(for: hourWord)
    if minute == 0 {
      return ClockLayout(hourLines: hourLines, minuteLines: [])
    }
    return ClockLayout(hourLines: hourLines, minuteLines: lines(for: minuteWord))
  }
}

struct ClockFaceView: View {
  var script: ClockScript = .fraktur
  var foreground: Color
  var background: Color
  var onOpenColors: (() -> Void)?
  var onOpenLearning: (() -> Void)?

  @Environment(\.isLuminanceReduced) private var isLuminanceReduced

  var body: some View {
    TimelineView(.periodic(from: .now, by: 1)) { context in
      let comps = Calendar.current.dateComponents([.hour, .minute], from: context.date)
      let hour = comps.hour ?? 0
      let minute = comps.minute ?? 0
      face(layout: ClockWordLayout.layout(hour: hour, minute: minute, script: script))
    }
    .opacity(isLuminanceReduced ? 0.55 : 1)
  }

  private func face(layout: ClockLayout) -> some View {
    GeometryReader { geo in
      let metrics = Self.metrics(for: layout, in: geo.size, script: script)
      VStack(spacing: metrics.gap) {
        ForEach(Array(layout.hourLines.enumerated()), id: \.offset) { _, line in
          scriptLine(line, size: metrics.scriptSize, color: foreground)
        }

        Text("UHR")
          .font(.system(size: metrics.uhrSize, weight: .bold))
          .tracking(metrics.uhrTracking)
          .foregroundStyle(foreground)
          .accessibilityHidden(true)

        ForEach(Array(layout.minuteLines.enumerated()), id: \.offset) { _, line in
          scriptLine(line, size: metrics.scriptSize, color: foreground)
        }
      }
      .frame(maxWidth: .infinity, maxHeight: .infinity)
      .padding(.horizontal, 4)
    }
    .background(background.ignoresSafeArea())
    .contentShape(Rectangle())
    .onTapGesture { onOpenColors?() }
    .simultaneousGesture(
      LongPressGesture(minimumDuration: 0.55)
        .onEnded { _ in onOpenLearning?() }
    )
    .accessibilityElement(children: .combine)
    .accessibilityLabel(accessibilityTimeLabel)
    .accessibilityHint(
      "\(script.accessibilityName). Tippen öffnet Farben. Wischen wechselt Schrift. Länger drücken öffnet Wortlernen."
    )
  }

  private func scriptLine(_ text: String, size: CGFloat, color: Color) -> some View {
    Text(text)
      .font(.custom(script.fontName, size: size))
      .foregroundStyle(color)
      .multilineTextAlignment(.center)
      .minimumScaleFactor(0.4)
      .lineLimit(1)
      .frame(maxWidth: .infinity)
  }

  private var accessibilityTimeLabel: String {
    let now = Date()
    let comps = Calendar.current.dateComponents([.hour, .minute], from: now)
    let h = comps.hour ?? 0
    let m = comps.minute ?? 0
    let hour = ClockNumberWords.hourModernWord(h)
    if m == 0 {
      return "\(hour) Uhr, \(script.accessibilityName)"
    }
    return "\(hour) Uhr \(ClockNumberWords.minuteModernWord(m)), \(script.accessibilityName)"
  }

  private struct Metrics {
    var scriptSize: CGFloat
    var uhrSize: CGFloat
    var uhrTracking: CGFloat
    var gap: CGFloat
  }

  private static func metrics(for layout: ClockLayout, in size: CGSize, script: ClockScript) -> Metrics {
    let lines = CGFloat(max(layout.lineCount, 2))
    let width = size.width
    let base = min(width * 0.26, size.height / (lines * 1.15)) * script.sizeScale
    let scriptSize = max(22, min(base, script == .suetterlin ? 58 : 52))
    let uhr = max(10, scriptSize * 0.17)
    let tracking = uhr * 2.0
    let gap = max(2, scriptSize * 0.05)
    return Metrics(scriptSize: scriptSize, uhrSize: uhr, uhrTracking: tracking, gap: gap)
  }
}

#Preview("Clock Fraktur") {
  ClockFaceView(script: .fraktur, foreground: .white, background: .black)
}

#Preview("Clock Sütterlin") {
  ClockFaceView(script: .suetterlin, foreground: .white, background: .black)
}
