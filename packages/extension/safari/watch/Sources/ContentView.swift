import SwiftUI
#if os(watchOS)
import WatchKit
#endif

struct ContentView: View {
  @State private var mode: ScriptMode = .fraktur
  @State private var index: Int = 0

  private var words: [WatchWord] { WatchData.catalog.words }

  private var current: WatchWord {
    guard !words.isEmpty else {
      return WatchWord(
        modern: "—",
        fraktur: WatchWordMode(word: "—", tips: []),
        kurrent: WatchWordMode(word: "—", tips: []),
        suetterlin: WatchWordMode(word: "—", tips: [])
      )
    }
    return words[index % words.count]
  }

  var body: some View {
    TabView(selection: $mode) {
      WordScrollView(word: current, mode: .fraktur, onNext: nextWord)
        .tag(ScriptMode.fraktur)
      WordScrollView(word: current, mode: .kurrent, onNext: nextWord)
        .tag(ScriptMode.kurrent)
      WordScrollView(word: current, mode: .suetterlin, onNext: nextWord)
        .tag(ScriptMode.suetterlin)
    }
    .tabViewStyle(.page(indexDisplayMode: .automatic))
    .onAppear(perform: pickInitial)
  }

  private func pickInitial() {
    guard words.count > 1 else { return }
    index = Int.random(in: 0..<words.count)
  }

  private func nextWord() {
    guard words.count > 1 else { return }
    var next = Int.random(in: 0..<words.count)
    var guardCount = 0
    while next == index && guardCount < 12 {
      next = Int.random(in: 0..<words.count)
      guardCount += 1
    }
    index = next
  }
}

struct WordScrollView: View {
  let word: WatchWord
  let mode: ScriptMode
  let onNext: () -> Void

  private var modeData: WatchWordMode { word.modeData(mode) }

  var body: some View {
    ScrollView {
      VStack(alignment: .center, spacing: 10) {
        Text(modeData.word)
          .font(.custom(mode.fontName, size: scriptSize))
          .multilineTextAlignment(.center)
          .minimumScaleFactor(0.35)
          .lineLimit(2)
          .frame(maxWidth: .infinity)
          .contentShape(Rectangle())
          .onTapGesture(perform: onNext)
          .accessibilityAddTraits(.isButton)
          .accessibilityLabel("Nächstes Wort")
          .accessibilityValue(modeData.word)

        Text(word.modern)
          .font(.system(.title3, design: .serif))
          .foregroundStyle(.secondary)
          .padding(.bottom, 8)

        if modeData.tips.isEmpty {
          Text("Keine Lernhinweise in diesem Modus.")
            .font(.caption2)
            .foregroundStyle(.tertiary)
            .multilineTextAlignment(.center)
        } else {
          ForEach(modeData.tips) { tip in
            TipCard(tip: tip, mode: mode)
          }
        }
      }
      .padding(.horizontal, 6)
      .padding(.bottom, 12)
    }
  }

  private var scriptSize: CGFloat {
    #if os(watchOS)
    return WKInterfaceDevice.current().screenBounds.width * 0.28
    #else
    return 40
    #endif
  }
}

struct TipCard: View {
  let tip: WatchTip
  let mode: ScriptMode

  var body: some View {
    VStack(alignment: .leading, spacing: 6) {
      Text(tip.title)
        .font(.headline)
        .frame(maxWidth: .infinity, alignment: .leading)

      if !tip.glyphs.isEmpty {
        HStack(spacing: 6) {
          ForEach(Array(tip.glyphs.enumerated()), id: \.offset) { _, glyph in
            Text(glyph)
              .font(.custom(mode.fontName, size: glyphSize))
          }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
      }

      Text(tip.confusion)
        .font(.caption)
        .foregroundStyle(.secondary)
        .fixedSize(horizontal: false, vertical: true)
    }
    .padding(8)
    .frame(maxWidth: .infinity, alignment: .leading)
    .background(
      RoundedRectangle(cornerRadius: 10, style: .continuous)
        .fill(Color.primary.opacity(0.06))
    )
  }

  /// Handschrift wirkt in derselben Punktgröße optisch kleiner — Beispiele doppelt so groß.
  private var glyphSize: CGFloat {
    mode == .kurrent || mode == .suetterlin ? 44 : 22
  }
}

#Preview {
  ContentView()
}
