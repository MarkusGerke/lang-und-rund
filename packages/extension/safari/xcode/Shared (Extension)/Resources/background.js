const r = {
  antiqua: 20,
  fraktur: 24,
  kurrent: 64
}, u = {
  displayMode: "fraktur",
  theme: "sepia",
  measure: "medium",
  leading: "normal",
  fontSizes: { ...r },
  textOnly: !0,
  drawerLiveCursor: !1,
  forceGerman: null
}, c = "langs-settings", m = "langs-article:";
function l(e) {
  if (!e)
    return {
      ...u,
      fontSizes: { ...r }
    };
  const t = { ...r };
  if (e.fontSizes && typeof e.fontSizes == "object") {
    const o = e.fontSizes;
    for (const a of Object.keys(r))
      typeof o[a] == "number" && (t[a] = o[a]);
    o.kurrent === 32 && (t.kurrent = r.kurrent);
  } else if (typeof e.fontSize == "number") {
    const o = e.displayMode === "fraktur" || e.displayMode === "kurrent" ? e.displayMode : "fraktur";
    t[o] = e.fontSize;
  }
  const n = e.displayMode === "antiqua" || e.displayMode === "fraktur" || e.displayMode === "kurrent" ? e.displayMode : "fraktur", i = e.leading === "compact" || e.leading === "normal" || e.leading === "loose" ? e.leading : "normal";
  return {
    displayMode: n,
    theme: e.theme === "dark" || e.theme === "light" || e.theme === "sepia" || e.theme === "graphite" ? e.theme : "sepia",
    measure: e.measure === "narrow" || e.measure === "wide" ? e.measure : "medium",
    leading: i,
    fontSizes: t,
    textOnly: e.textOnly !== !1,
    drawerLiveCursor: e.drawerLiveCursor === !0,
    forceGerman: e.forceGerman === !0 || e.forceGerman === !1 ? e.forceGerman : null
  };
}
async function f() {
  const e = await chrome.storage.sync.get(c);
  return l(e[c]);
}
async function g() {
  const [e] = await chrome.tabs.query({ active: !0, currentWindow: !0 });
  return e;
}
function h(e) {
  return e ? /^(chrome|chrome-extension|moz-extension|about|edge|brave|devtools):/i.test(
    e
  ) : !0;
}
async function y(e, t) {
  return await chrome.scripting.executeScript({
    target: { tabId: e },
    files: ["content.js"]
  }), await chrome.tabs.sendMessage(e, {
    type: "EXTRACT_ARTICLE",
    forceGerman: t
  });
}
async function p(e) {
  const t = `${m}${e.id}`;
  await chrome.storage.session.set({
    [t]: e,
    "langs-latest": e.id
  });
  const n = chrome.runtime.getURL(
    `reader.html?id=${encodeURIComponent(e.id)}`
  );
  await chrome.tabs.create({ url: n });
}
async function s(e, t) {
  await chrome.action.setBadgeText({ text: "!", tabId: e }), await chrome.action.setBadgeBackgroundColor({ color: "#8b4513", tabId: e }), await chrome.action.setTitle({ title: `lang & rund: ${t}`, tabId: e }), setTimeout(() => {
    chrome.action.setBadgeText({ text: "", tabId: e });
  }, 4e3);
}
async function d() {
  const e = await g();
  if (!(e != null && e.id)) return;
  if (h(e.url)) {
    await s(e.id, "Diese Seite kann nicht gelesen werden");
    return;
  }
  const t = await f();
  let n;
  try {
    n = await y(e.id, t.forceGerman);
  } catch (o) {
    console.error("[lang & rund] Extraktion fehlgeschlagen", o), await s(e.id, "Extraktion fehlgeschlagen");
    return;
  }
  if (!n.ok) {
    await s(e.id, n.message);
    return;
  }
  await chrome.action.setBadgeText({ text: "", tabId: e.id });
  const i = {
    ...n.article,
    id: crypto.randomUUID(),
    createdAt: Date.now()
  };
  await p(i);
}
chrome.action.onClicked.addListener(() => {
  d();
});
chrome.commands.onCommand.addListener((e) => {
  e === "open-reader" && d();
});
//# sourceMappingURL=background.js.map
