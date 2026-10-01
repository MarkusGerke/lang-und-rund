const s = {
  antiqua: 20,
  fraktur: 24,
  /** Desktop-Default; mobil (≤640) Override auf KURRENT_FONT_SIZE_MOBILE wenn noch Default. */
  kurrent: 68,
  /** 16× STEP unter dem Kurrent-Desktop-Default. */
  suetterlin: 36
}, N = [
  "light",
  "sepia",
  "graphite",
  "dark",
  "lagune",
  "salbei",
  "flieder",
  "koralle",
  "tiefsee",
  "wald",
  "honig",
  "pflaume",
  "himmel",
  "rost",
  "schiefer",
  "rose"
];
function M(e) {
  return typeof e == "string" && N.includes(e);
}
function h(e) {
  return e === "antiqua" || e === "fraktur" || e === "kurrent" || e === "suetterlin";
}
const D = 0.5, _ = 4, k = 0.1, x = 1.4, E = {
  compact: 1.4,
  normal: 1.75,
  loose: 2.2
};
function S(e) {
  const t = Math.round(e / k) * k;
  return Math.min(_, Math.max(D, Number(t.toFixed(1))));
}
function b(e) {
  if (typeof e == "number" && Number.isFinite(e))
    return S(e);
  if (typeof e == "string") {
    if (e in E) return E[e];
    const t = Number(e);
    if (Number.isFinite(t)) return S(t);
  }
  return x;
}
const w = {
  displayMode: "fraktur",
  theme: "sepia",
  measure: "medium",
  leading: x,
  fontSizes: { ...s },
  textOnly: !0,
  drawerLiveCursor: !1,
  drawerWordClick: !0,
  forceGerman: null
}, T = "langs-settings", F = "langs-article:";
function R() {
  var e, t;
  try {
    const n = (t = (e = globalThis.chrome) == null ? void 0 : e.runtime) == null ? void 0 : t.id;
    return typeof n == "string" && n.length > 0;
  } catch {
    return !1;
  }
}
function U() {
  var t;
  if (new URLSearchParams(location.search).get("host") === "1") return !0;
  if (R()) return !1;
  try {
    return typeof ((t = chrome == null ? void 0 : chrome.runtime) == null ? void 0 : t.id) != "string";
  } catch {
    return !0;
  }
}
function z() {
  const e = new URLSearchParams(location.search);
  if (e.toString() === "") return null;
  const t = {};
  let n = !1;
  const o = e.get("dm");
  o && h(o) && (t.displayMode = o, n = !0);
  const r = e.get("th");
  r && M(r) && (t.theme = r, n = !0);
  const i = e.get("me");
  (i === "narrow" || i === "medium" || i === "wide") && (t.measure = i, n = !0);
  const u = e.get("ld");
  u != null && u !== "" && (t.leading = b(u), n = !0);
  const d = e.get("to");
  (d === "0" || d === "1") && (t.textOnly = d === "1", n = !0);
  const f = e.get("lc");
  (f === "0" || f === "1") && (t.drawerLiveCursor = f === "1", n = !0);
  const l = e.get("wc");
  (l === "0" || l === "1") && (t.drawerWordClick = l === "1", n = !0);
  const p = e.get("fs");
  if (p) {
    const m = p.split(",").map((c) => Number(c.trim()));
    if (m.length === 4 && m.every((c) => Number.isFinite(c))) {
      const c = ["fraktur", "kurrent", "suetterlin", "antiqua"], y = {};
      c.forEach((C, G) => {
        y[C] = m[G];
      }), t.fontSizes = y, n = !0;
    }
  }
  const a = e.get("fg");
  return (a === "auto" || a === "yes" || a === "no") && (t.forceGerman = a === "yes" ? !0 : a === "no" ? !1 : null, n = !0), n ? t : null;
}
function L(e) {
  if (!e)
    return {
      ...w,
      fontSizes: { ...s }
    };
  const t = { ...s };
  if (e.fontSizes && typeof e.fontSizes == "object") {
    const r = e.fontSizes;
    for (const i of Object.keys(s))
      typeof r[i] == "number" && (t[i] = r[i]);
    (r.kurrent === 32 || r.kurrent === 64) && (t.kurrent = s.kurrent), (r.suetterlin === 68 || r.suetterlin === 44) && (t.suetterlin = s.suetterlin);
  } else if (typeof e.fontSize == "number") {
    const r = h(e.displayMode) ? e.displayMode : "fraktur";
    t[r] = e.fontSize;
  }
  const n = h(e.displayMode) ? e.displayMode : "fraktur";
  return {
    displayMode: n === "antiqua" ? "fraktur" : n,
    theme: M(e.theme) ? e.theme : "sepia",
    measure: e.measure === "narrow" || e.measure === "wide" ? e.measure : "medium",
    leading: b(e.leading),
    fontSizes: t,
    textOnly: e.textOnly !== !1,
    drawerLiveCursor: e.drawerLiveCursor === !0,
    drawerWordClick: e.drawerWordClick !== !1,
    forceGerman: e.forceGerman === !0 || e.forceGerman === !1 ? e.forceGerman : null
  };
}
async function I() {
  if (U()) {
    const t = z();
    return L(t ?? void 0);
  }
  const e = await chrome.storage.sync.get(T);
  return L(e[T]);
}
async function v() {
  const [e] = await chrome.tabs.query({ active: !0, currentWindow: !0 });
  return e;
}
function O(e) {
  return e ? /^(chrome|chrome-extension|moz-extension|about|edge|brave|devtools):/i.test(
    e
  ) : !0;
}
async function B(e, t) {
  return await chrome.scripting.executeScript({
    target: { tabId: e },
    files: ["content.js"]
  }), await chrome.tabs.sendMessage(e, {
    type: "EXTRACT_ARTICLE",
    forceGerman: t
  });
}
async function q(e) {
  const t = `${F}${e.id}`;
  await chrome.storage.session.set({
    [t]: e,
    "langs-latest": e.id
  });
  const n = chrome.runtime.getURL(
    `reader.html?id=${encodeURIComponent(e.id)}`
  );
  await chrome.tabs.create({ url: n });
}
async function g(e, t) {
  await chrome.action.setBadgeText({ text: "!", tabId: e }), await chrome.action.setBadgeBackgroundColor({ color: "#8b4513", tabId: e }), await chrome.action.setTitle({ title: `lang & rund: ${t}`, tabId: e }), setTimeout(() => {
    chrome.action.setBadgeText({ text: "", tabId: e });
  }, 4e3);
}
async function A() {
  const e = await v();
  if (!(e != null && e.id)) return;
  if (O(e.url)) {
    await g(e.id, "Diese Seite kann nicht gelesen werden");
    return;
  }
  const t = await I();
  let n;
  try {
    n = await B(e.id, t.forceGerman);
  } catch (r) {
    console.error("[lang & rund] Extraktion fehlgeschlagen", r), await g(e.id, "Extraktion fehlgeschlagen");
    return;
  }
  if (!n.ok) {
    await g(e.id, n.message);
    return;
  }
  await chrome.action.setBadgeText({ text: "", tabId: e.id });
  const o = {
    ...n.article,
    id: crypto.randomUUID(),
    createdAt: Date.now()
  };
  await q(o);
}
chrome.action.onClicked.addListener(() => {
  A();
});
chrome.commands.onCommand.addListener((e) => {
  e === "open-reader" && A();
});
//# sourceMappingURL=background.js.map
