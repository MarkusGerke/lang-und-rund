const r = {
  antiqua: 20,
  fraktur: 24,
  /** Desktop-Default; mobil (≤640) Override auf KURRENT_FONT_SIZE_MOBILE wenn noch Default. */
  kurrent: 68,
  /** 16× STEP unter dem Kurrent-Desktop-Default. */
  suetterlin: 36
};
function a(e) {
  return e === "antiqua" || e === "fraktur" || e === "kurrent" || e === "suetterlin";
}
const g = 0.7, h = 4, c = 0.05, f = 1.4, u = {
  compact: 1.4,
  normal: 1.75,
  loose: 2.2
};
function d(e) {
  const t = Math.round(e / c) * c;
  return Math.min(h, Math.max(g, Number(t.toFixed(2))));
}
function p(e) {
  if (typeof e == "number" && Number.isFinite(e))
    return d(e);
  if (typeof e == "string") {
    if (e in u) return u[e];
    const t = Number(e);
    if (Number.isFinite(t)) return d(t);
  }
  return f;
}
const y = {
  displayMode: "fraktur",
  theme: "sepia",
  measure: "medium",
  leading: f,
  fontSizes: { ...r },
  textOnly: !0,
  drawerLiveCursor: !1,
  forceGerman: null
}, m = "langs-settings", E = "langs-article:";
function k(e) {
  if (!e)
    return {
      ...y,
      fontSizes: { ...r }
    };
  const t = { ...r };
  if (e.fontSizes && typeof e.fontSizes == "object") {
    const n = e.fontSizes;
    for (const o of Object.keys(r))
      typeof n[o] == "number" && (t[o] = n[o]);
    (n.kurrent === 32 || n.kurrent === 64) && (t.kurrent = r.kurrent), (n.suetterlin === 68 || n.suetterlin === 44) && (t.suetterlin = r.suetterlin);
  } else if (typeof e.fontSize == "number") {
    const n = a(e.displayMode) ? e.displayMode : "fraktur";
    t[n] = e.fontSize;
  }
  return {
    displayMode: a(e.displayMode) ? e.displayMode : "fraktur",
    theme: e.theme === "dark" || e.theme === "light" || e.theme === "sepia" || e.theme === "graphite" ? e.theme : "sepia",
    measure: e.measure === "narrow" || e.measure === "wide" ? e.measure : "medium",
    leading: p(e.leading),
    fontSizes: t,
    textOnly: e.textOnly !== !1,
    drawerLiveCursor: e.drawerLiveCursor === !0,
    forceGerman: e.forceGerman === !0 || e.forceGerman === !1 ? e.forceGerman : null
  };
}
async function T() {
  const e = await chrome.storage.sync.get(m);
  return k(e[m]);
}
async function L() {
  const [e] = await chrome.tabs.query({ active: !0, currentWindow: !0 });
  return e;
}
function x(e) {
  return e ? /^(chrome|chrome-extension|moz-extension|about|edge|brave|devtools):/i.test(
    e
  ) : !0;
}
async function S(e, t) {
  return await chrome.scripting.executeScript({
    target: { tabId: e },
    files: ["content.js"]
  }), await chrome.tabs.sendMessage(e, {
    type: "EXTRACT_ARTICLE",
    forceGerman: t
  });
}
async function A(e) {
  const t = `${E}${e.id}`;
  await chrome.storage.session.set({
    [t]: e,
    "langs-latest": e.id
  });
  const i = chrome.runtime.getURL(
    `reader.html?id=${encodeURIComponent(e.id)}`
  );
  await chrome.tabs.create({ url: i });
}
async function s(e, t) {
  await chrome.action.setBadgeText({ text: "!", tabId: e }), await chrome.action.setBadgeBackgroundColor({ color: "#8b4513", tabId: e }), await chrome.action.setTitle({ title: `lang & rund: ${t}`, tabId: e }), setTimeout(() => {
    chrome.action.setBadgeText({ text: "", tabId: e });
  }, 4e3);
}
async function l() {
  const e = await L();
  if (!(e != null && e.id)) return;
  if (x(e.url)) {
    await s(e.id, "Diese Seite kann nicht gelesen werden");
    return;
  }
  const t = await T();
  let i;
  try {
    i = await S(e.id, t.forceGerman);
  } catch (o) {
    console.error("[lang & rund] Extraktion fehlgeschlagen", o), await s(e.id, "Extraktion fehlgeschlagen");
    return;
  }
  if (!i.ok) {
    await s(e.id, i.message);
    return;
  }
  await chrome.action.setBadgeText({ text: "", tabId: e.id });
  const n = {
    ...i.article,
    id: crypto.randomUUID(),
    createdAt: Date.now()
  };
  await A(n);
}
chrome.action.onClicked.addListener(() => {
  l();
});
chrome.commands.onCommand.addListener((e) => {
  e === "open-reader" && l();
});
//# sourceMappingURL=background.js.map
