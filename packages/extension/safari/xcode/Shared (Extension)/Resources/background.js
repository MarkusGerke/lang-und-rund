const i = {
  antiqua: 20,
  fraktur: 24,
  /** Desktop-Default; mobil (≤640) Override auf KURRENT_FONT_SIZE_MOBILE wenn noch Default. */
  kurrent: 68,
  /** 16× STEP unter dem Kurrent-Desktop-Default. */
  suetterlin: 36
}, h = [
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
function p(e) {
  return typeof e == "string" && h.includes(e);
}
function c(e) {
  return e === "antiqua" || e === "fraktur" || e === "kurrent" || e === "suetterlin";
}
const y = 0.5, E = 4, u = 0.05, l = 1.4, d = {
  compact: 1.4,
  normal: 1.75,
  loose: 2.2
};
function f(e) {
  const t = Math.round(e / u) * u;
  return Math.min(E, Math.max(y, Number(t.toFixed(2))));
}
function k(e) {
  if (typeof e == "number" && Number.isFinite(e))
    return f(e);
  if (typeof e == "string") {
    if (e in d) return d[e];
    const t = Number(e);
    if (Number.isFinite(t)) return f(t);
  }
  return l;
}
const T = {
  displayMode: "fraktur",
  theme: "sepia",
  measure: "medium",
  leading: l,
  fontSizes: { ...i },
  textOnly: !0,
  drawerLiveCursor: !1,
  forceGerman: null
}, m = "langs-settings", L = "langs-article:";
function M(e) {
  if (!e)
    return {
      ...T,
      fontSizes: { ...i }
    };
  const t = { ...i };
  if (e.fontSizes && typeof e.fontSizes == "object") {
    const n = e.fontSizes;
    for (const o of Object.keys(i))
      typeof n[o] == "number" && (t[o] = n[o]);
    (n.kurrent === 32 || n.kurrent === 64) && (t.kurrent = i.kurrent), (n.suetterlin === 68 || n.suetterlin === 44) && (t.suetterlin = i.suetterlin);
  } else if (typeof e.fontSize == "number") {
    const n = c(e.displayMode) ? e.displayMode : "fraktur";
    t[n] = e.fontSize;
  }
  const r = c(e.displayMode) ? e.displayMode : "fraktur";
  return {
    displayMode: r === "antiqua" ? "fraktur" : r,
    theme: p(e.theme) ? e.theme : "sepia",
    measure: e.measure === "narrow" || e.measure === "wide" ? e.measure : "medium",
    leading: k(e.leading),
    fontSizes: t,
    textOnly: e.textOnly !== !1,
    drawerLiveCursor: e.drawerLiveCursor === !0,
    forceGerman: e.forceGerman === !0 || e.forceGerman === !1 ? e.forceGerman : null
  };
}
async function S() {
  const e = await chrome.storage.sync.get(m);
  return M(e[m]);
}
async function x() {
  const [e] = await chrome.tabs.query({ active: !0, currentWindow: !0 });
  return e;
}
function b(e) {
  return e ? /^(chrome|chrome-extension|moz-extension|about|edge|brave|devtools):/i.test(
    e
  ) : !0;
}
async function A(e, t) {
  return await chrome.scripting.executeScript({
    target: { tabId: e },
    files: ["content.js"]
  }), await chrome.tabs.sendMessage(e, {
    type: "EXTRACT_ARTICLE",
    forceGerman: t
  });
}
async function D(e) {
  const t = `${L}${e.id}`;
  await chrome.storage.session.set({
    [t]: e,
    "langs-latest": e.id
  });
  const r = chrome.runtime.getURL(
    `reader.html?id=${encodeURIComponent(e.id)}`
  );
  await chrome.tabs.create({ url: r });
}
async function s(e, t) {
  await chrome.action.setBadgeText({ text: "!", tabId: e }), await chrome.action.setBadgeBackgroundColor({ color: "#8b4513", tabId: e }), await chrome.action.setTitle({ title: `lang & rund: ${t}`, tabId: e }), setTimeout(() => {
    chrome.action.setBadgeText({ text: "", tabId: e });
  }, 4e3);
}
async function g() {
  const e = await x();
  if (!(e != null && e.id)) return;
  if (b(e.url)) {
    await s(e.id, "Diese Seite kann nicht gelesen werden");
    return;
  }
  const t = await S();
  let r;
  try {
    r = await A(e.id, t.forceGerman);
  } catch (n) {
    console.error("[lang & rund] Extraktion fehlgeschlagen", n), await s(e.id, "Extraktion fehlgeschlagen");
    return;
  }
  if (!r.ok) {
    await s(e.id, r.message);
    return;
  }
  await chrome.action.setBadgeText({ text: "", tabId: e.id });
  const a = {
    ...r.article,
    id: crypto.randomUUID(),
    createdAt: Date.now()
  };
  await D(a);
}
chrome.action.onClicked.addListener(() => {
  g();
});
chrome.commands.onCommand.addListener((e) => {
  e === "open-reader" && g();
});
//# sourceMappingURL=background.js.map
