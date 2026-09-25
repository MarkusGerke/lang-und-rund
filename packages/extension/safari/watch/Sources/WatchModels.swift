import Foundation

enum ScriptMode: String, CaseIterable, Identifiable {
  case fraktur
  case kurrent

  var id: String { rawValue }

  var fontName: String {
    switch self {
    case .fraktur: return "UnifrakturMaguntia"
    case .kurrent: return "Deutsche Kurrent"
    }
  }
}

struct WatchTip: Codable, Identifiable {
  let id: String
  let title: String
  let confusion: String
  let glyphs: [String]
}

struct WatchWordMode: Codable {
  let word: String
  let tips: [WatchTip]
}

struct WatchWord: Codable, Identifiable {
  let modern: String
  let fraktur: WatchWordMode
  let kurrent: WatchWordMode

  var id: String { modern }

  func modeData(_ mode: ScriptMode) -> WatchWordMode {
    switch mode {
    case .fraktur: return fraktur
    case .kurrent: return kurrent
    }
  }
}

struct WatchCatalog: Codable {
  let version: Int
  let words: [WatchWord]
}

enum WatchData {
  static let catalog: WatchCatalog = {
    guard let url = Bundle.main.url(forResource: "watchWords", withExtension: "json"),
          let data = try? Data(contentsOf: url),
          let decoded = try? JSONDecoder().decode(WatchCatalog.self, from: data),
          !decoded.words.isEmpty
    else {
      return WatchCatalog(
        version: 0,
        words: [
          WatchWord(
            modern: "Haus",
            fraktur: WatchWordMode(word: "Haus", tips: []),
            kurrent: WatchWordMode(word: "Haus", tips: []),
          ),
        ],
      )
    }
    return decoded
  }()
}
