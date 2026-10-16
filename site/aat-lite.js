/**
 * AAT playground: a plain-JS port of the AAT widget (references/components/aat) that runs on the
 * page inside the #pg iframe. Same tray, pin, pen, comment box, pins, notes panel, toast and prompt.
 * The prompt and element facts follow describe.ts; the screenshot follows shot.ts.
 */
(() => {
  const stage = document.getElementById("stage");
  const frame = document.getElementById("pg");
  const out = document.getElementById("out");
  const outShot = document.getElementById("outShot");
  const copyTry = document.getElementById("copyTry");
  if (!stage || !frame) return;

  const RED = "#ef4444";
  const STORE = "aat-playground.notes";
  const MAX_NOTES = 200;
  const APP = "the playground";

  // ---------- facts about elements (describe.ts) ----------
  const clip = (s, n) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);
  const oneLine = (s) => (s ?? "").replace(/\s+/g, " ").trim();
  const stableId = (id) => id && !/[:«»]|^r\d|[0-9a-f]{8,}/i.test(id);
  const esc = (v) => (window.CSS && CSS.escape ? CSS.escape(v) : v);

  function selectorFor(el) {
    const d = el.ownerDocument;
    if (el.id && stableId(el.id) && d.querySelectorAll(`#${esc(el.id)}`).length === 1) return `#${esc(el.id)}`;
    const parts = [];
    let cur = el;
    while (cur && cur !== d.body && cur !== d.documentElement && parts.length < 8) {
      if (cur.id && stableId(cur.id)) { parts.unshift(`#${esc(cur.id)}`); break; }
      const testId = cur.getAttribute("data-testid");
      if (testId) { parts.unshift(`[data-testid="${testId}"]`); break; }
      const tag = cur.tagName.toLowerCase();
      const parent = cur.parentElement;
      const same = parent ? Array.from(parent.children).filter((c) => c.tagName === cur.tagName) : [];
      parts.unshift(same.length > 1 ? `${tag}:nth-of-type(${same.indexOf(cur) + 1})` : tag);
      cur = parent;
    }
    if (cur === d.body) parts.unshift("body");
    return parts.join(" > ");
  }
  function hex(rgb) {
    const m = rgb.match(/rgba?\(([\d.]+),\s*([\d.]+),\s*([\d.]+)(?:,\s*([\d.]+))?\)/);
    if (!m) return rgb;
    const h = [m[1], m[2], m[3]].map((v) => Math.round(Number(v)).toString(16).padStart(2, "0")).join("");
    return m[4] !== undefined && Number(m[4]) < 1 ? `#${h} at ${Math.round(Number(m[4]) * 100)}% opacity` : `#${h}`;
  }
  function styleOf(el) {
    const s = el.ownerDocument.defaultView.getComputedStyle(el);
    const font = s.fontFamily.split(",")[0].replace(/["']/g, "").trim();
    const o = [`font: ${font} ${s.fontSize}, weight ${s.fontWeight}, line-height ${s.lineHeight}`, `color: ${hex(s.color)}`];
    if (!/rgba\(0, 0, 0, 0\)|transparent/.test(s.backgroundColor)) o.push(`background: ${hex(s.backgroundColor)}`);
    if (s.backgroundImage && s.backgroundImage !== "none") o.push(`background-image: ${clip(s.backgroundImage, 90)}`);
    if (s.padding !== "0px") o.push(`padding: ${s.padding}`);
    if (s.margin !== "0px") o.push(`margin: ${s.margin}`);
    if (s.borderRadius !== "0px") o.push(`radius: ${parseFloat(s.borderRadius) > 9999 ? "full (pill)" : s.borderRadius}`);
    if (s.borderTopWidth !== "0px" && s.borderTopStyle !== "none") o.push(`border: ${s.borderTopWidth} ${s.borderTopStyle} ${hex(s.borderTopColor)}`);
    if (s.display === "flex" || s.display === "grid") o.push(`layout: ${s.display}, gap ${s.gap}, align ${s.alignItems}, justify ${s.justifyContent}`);
    if (s.textAlign !== "start") o.push(`text-align: ${s.textAlign}`);
    return o;
  }
  function describe(el) {
    const r = el.getBoundingClientRect();
    const w = el.ownerDocument.defaultView;
    const attrs = [];
    for (const a of ["aria-label", "placeholder", "alt", "title", "href", "name", "type", "role", "src"]) {
      const v = el.getAttribute(a);
      if (v) attrs.push(`${a}="${clip(oneLine(v), 80)}"`);
    }
    return {
      tag: el.tagName.toLowerCase(),
      text: clip(oneLine(el.innerText ?? el.textContent), 120),
      selector: selectorFor(el),
      attrs,
      classes: clip(oneLine(typeof el.className === "string" ? el.className : el.getAttribute("class")), 220),
      box: `${Math.round(r.width)}x${Math.round(r.height)}px at x ${Math.round(r.left + w.scrollX)}, y ${Math.round(r.top + w.scrollY)} (page)`,
      style: styleOf(el),
    };
  }
  const innermost = (els) => { const u = Array.from(new Set(els)); return u.filter((a) => !u.some((b) => b !== a && a.contains(b))); };
  function commonAncestor(els) {
    if (!els.length) return null;
    let anc = els[0];
    while (anc && !els.every((e) => anc.contains(e))) anc = anc.parentElement;
    return anc;
  }
  function elBlock(e, label) {
    const lines = [`${label}: <${e.tag}>${e.text ? ` "${e.text}"` : ""}`, `  Selector: ${e.selector}`];
    if (e.attrs.length) lines.push(`  Attributes: ${e.attrs.join(", ")}`);
    if (e.classes) lines.push(`  Classes: ${e.classes}`);
    lines.push(`  Size: ${e.box}`, `  Current style: ${e.style.join("; ")}`);
    return lines.join("\n");
  }
  function buildPrompt(note, hasImage) {
    const head = note.kind === "pin"
      ? "I pinned one element on the page and wrote a comment about it."
      : `I marked an area of the page with a pen. The stroke went over ${note.elements.length} element${note.elements.length === 1 ? "" : "s"}.`;
    const parts = [`[AAT note ${note.n}] Change request for ${APP}`, "", head, "", `My comment: ${note.comment}`, "",
      `Page: ${note.url}${note.title ? ` ("${note.title}")` : ""}`, `Viewport: ${note.viewport}`];
    if (hasImage) parts.push("Screenshot: I am pasting an image of the marked spot (my mark drawn in red) with this prompt.");
    parts.push("");
    note.elements.forEach((e, i) => parts.push(elBlock(e, note.elements.length === 1 ? "Element" : `Element ${i + 1}`), ""));
    if (note.section) parts.push(elBlock(note.section, "Section that holds the marked elements"), "");
    parts.push("Find these elements in the codebase (search for the visible text, the React component names and the classes), make the change my comment asks for, and keep everything else exactly as it is. If the comment is unclear, ask me before changing anything.");
    return parts.join("\n");
  }

  // ---------- screenshot of the marked spot (shot.ts) ----------
  let shotLib = null;
  const loadShot = () => (shotLib ??= import("https://cdn.jsdelivr.net/npm/modern-screenshot@4.7.0/+esm").catch(() => null));
  async function captureMark(doc, targets, stroke) {
    try {
      const lib = await loadShot();
      if (!lib || !targets.length) return null;
      const PAD = 48;
      const rects = stroke && stroke.length ? stroke.map((p) => ({ left: p.x, top: p.y, right: p.x, bottom: p.y })) : targets.map((t) => t.getBoundingClientRect());
      const mark = rects.reduce((a, r) => ({ left: Math.min(a.left, r.left), top: Math.min(a.top, r.top), right: Math.max(a.right, r.right), bottom: Math.max(a.bottom, r.bottom) }), { left: Infinity, top: Infinity, right: -Infinity, bottom: -Infinity });
      const want = { left: mark.left - PAD, top: mark.top - PAD, right: mark.right + PAD, bottom: mark.bottom + PAD };
      let host = commonAncestor(targets) || doc.body;
      while (host && host.parentElement && host !== doc.body) {
        const r = host.getBoundingClientRect();
        if (r.left <= want.left && r.top <= want.top && r.right >= want.right && r.bottom >= want.bottom) break;
        host = host.parentElement;
      }
      const hr = host.getBoundingClientRect();
      const full = await lib.domToCanvas(host, { scale: Math.min(2, window.devicePixelRatio || 1), backgroundColor: "#ffffff", timeout: 8000 });
      const k = full.width / Math.max(1, hr.width);
      const cx = Math.max(0, want.left - hr.left), cy = Math.max(0, want.top - hr.top);
      const cw = Math.min(hr.width, want.right - hr.left) - cx, ch = Math.min(hr.height, want.bottom - hr.top) - cy;
      if (cw < 4 || ch < 4) return null;
      const c = document.createElement("canvas");
      c.width = Math.round(cw * k); c.height = Math.round(ch * k);
      const g = c.getContext("2d");
      g.drawImage(full, cx * k, cy * k, cw * k, ch * k, 0, 0, c.width, c.height);
      const ox = hr.left + cx, oy = hr.top + cy;
      g.strokeStyle = RED; g.lineCap = "round"; g.lineJoin = "round";
      if (stroke && stroke.length) {
        g.lineWidth = 5 * k; g.beginPath();
        stroke.forEach((p, i) => (i ? g.lineTo((p.x - ox) * k, (p.y - oy) * k) : g.moveTo((p.x - ox) * k, (p.y - oy) * k)));
        g.stroke();
      } else {
        g.lineWidth = 3 * k; g.beginPath();
        g.roundRect((mark.left - ox - 4) * k, (mark.top - oy - 4) * k, (mark.right - mark.left + 8) * k, (mark.bottom - mark.top + 8) * k, 6 * k);
        g.stroke();
      }
      return await new Promise((res) => c.toBlob((b) => res(b), "image/png"));
    } catch { return null; }
  }

  // ---------- state ----------
  let doc = null, open = false, mode = "off", panel = false, draft = null, scope = "page";
  let composer = null, panelEl = null, lastPrompt = "", cursorStyle = null, pts = [], drawing = false;
  const shots = new Map();
  const loadNotes = () => { try { const v = JSON.parse(localStorage.getItem(STORE) ?? "[]"); return Array.isArray(v) ? v : []; } catch { return []; } };
  let notes = loadNotes();
  const saveNotes = () => { try { localStorage.setItem(STORE, JSON.stringify(notes.slice(-MAX_NOTES))); } catch {} };
  const nextN = () => notes.reduce((m, x) => Math.max(m, x.n), 0) + 1;
  const copyText = async (t) => { try { await navigator.clipboard.writeText(t); return true; } catch { return false; } };
  const copyImage = async (b) => { try { await navigator.clipboard.write([new ClipboardItem({ "image/png": b })]); return true; } catch { return false; } };

  // ---------- DOM ----------
  const icon = {
    open: '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/><path d="M13 8H7"/><path d="M17 12H7"/>',
    pin: '<path d="M20 10c0 5-5.5 10.2-7.4 11.8a1 1 0 0 1-1.2 0C9.5 20.2 4 15 4 10a8 8 0 0 1 16 0"/><circle cx="12" cy="10" r="3"/>',
    pen: '<path d="M12 20h9"/><path d="M16.4 3.6a1 1 0 0 1 3 3L7.4 18.6a2 2 0 0 1-.9.5l-2.9.8a.5.5 0 0 1-.6-.6l.8-2.9a2 2 0 0 1 .5-.9z"/>',
    list: '<path d="M3 12h.01M3 18h.01M3 6h.01M8 12h13M8 18h13M8 6h13"/>',
    x: '<path d="M18 6 6 18"/><path d="m6 6 12 12"/>',
    copy: '<rect width="14" height="14" x="8" y="8" rx="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/>',
    img: '<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.1-3.1a2 2 0 0 0-2.8 0L6 21"/>',
    trash: '<path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>',
  };
  const svg = (p, s = 17) => `<svg viewBox="0 0 24 24" width="${s}" height="${s}" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${p}</svg>`;
  const el = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; };

  const layer = el("div", "aat-layer");
  const hov = el("div", "hov", "<span></span>");
  const pinsLayer = el("div", "aat-pins");
  const pen = el("canvas", "aat-pen");
  const hint = el("div", "hintpill");
  const tray = el("div", "aat-tray");
  const toastBox = el("div", "aat-toasts");
  layer.append(pen, hov, pinsLayer, hint, tray, toastBox);
  stage.append(layer);

  function renderTray() {
    tray.innerHTML = "";
    const btn = (label, ic, on, fn, extra = "") => {
      const b = el("button", "", svg(ic) + extra);
      b.type = "button"; b.title = label; b.setAttribute("aria-label", label);
      if (on !== undefined) b.setAttribute("aria-pressed", String(on));
      b.onclick = fn; tray.append(b); return b;
    };
    if (!open) { btn("Admin Annotation Tool", icon.open, undefined, () => { open = true; render(); }); return; }
    btn("Pin an element", icon.pin, mode === "pin", () => choose("pin"));
    btn("Draw with the pen", icon.pen, mode === "pen", () => choose("pen"));
    btn("Notes", icon.list, panel, () => { panel = !panel; render(); }, notes.length ? `<span class="tray-n">${notes.length}</span>` : "");
    tray.append(el("span", "aat-div"));
    btn("Close AAT", icon.x, undefined, () => { draft = null; mode = "off"; panel = false; open = false; render(); });
  }
  function choose(m) { draft = null; mode = mode === m ? "off" : m; render(); }

  function renderHint() {
    const show = open && mode !== "off" && !draft;
    hint.style.display = show || !open ? "" : "none";
    hint.textContent = !open ? "Open the tray on the right to try AAT"
      : mode === "pin" ? "Click any element to pin a note · Esc to stop" : "Draw over anything, release to comment · Esc to stop";
  }

  // ---------- pins that follow their element ----------
  function visible(node) {
    const w = node.ownerDocument.defaultView;
    for (let n = node; n && n.nodeType === 1; n = n.parentElement) {
      const s = w.getComputedStyle(n);
      if (s.visibility === "hidden" || s.display === "none" || s.opacity === "0") return false;
    }
    return true;
  }
  function measurePins() {
    pinsLayer.innerHTML = "";
    if (!open || !doc) return;
    for (const note of notes) {
      let t = null;
      try { t = doc.querySelector(note.anchor.selector); } catch {}
      if (!t || !visible(t)) continue;
      const r = t.getBoundingClientRect();
      if (!r.width && !r.height) continue;
      const d = el("button", "dot aat-dot", String(note.n));
      d.type = "button"; d.title = `Note ${note.n}`;
      Object.assign(d.style, { left: `${r.left + r.width * note.anchor.rx}px`, top: `${r.top + r.height * note.anchor.ry}px` });
      d.onclick = () => { panel = true; render(); };
      pinsLayer.append(d);
    }
    if (draft && draft.kind === "pin") {
      const d = el("div", "dot", String(nextN()));
      Object.assign(d.style, { left: `${draft.at.x}px`, top: `${draft.at.y}px` });
      pinsLayer.append(d);
    }
  }
  setInterval(() => { if (open) measurePins(); }, 700);

  // ---------- pen ----------
  function paint(list) {
    const dpr = window.devicePixelRatio || 1, W = stage.clientWidth, H = stage.clientHeight;
    if (pen.width !== W * dpr || pen.height !== H * dpr) { pen.width = W * dpr; pen.height = H * dpr; }
    const g = pen.getContext("2d");
    g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, W, H);
    if (!list || !list.length) return;
    g.strokeStyle = RED; g.globalAlpha = 0.85; g.lineWidth = 7; g.lineCap = "round"; g.lineJoin = "round";
    g.beginPath(); list.forEach((p, i) => (i ? g.lineTo(p.x, p.y) : g.moveTo(p.x, p.y))); g.stroke();
  }
  const local = (e) => { const r = stage.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };
  const inside = (p, poly) => { let hit = false; for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) { const a = poly[i], b = poly[j]; if ((a.y > p.y) !== (b.y > p.y) && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x) hit = !hit; } return hit; };
  pen.addEventListener("pointerdown", (e) => { if (draft) return; pen.setPointerCapture(e.pointerId); drawing = true; pts = [local(e)]; paint(pts); });
  pen.addEventListener("pointermove", (e) => { if (!drawing) return; pts.push(local(e)); paint(pts); });
  const finish = () => {
    if (!drawing) return;
    drawing = false;
    const stroke = pts;
    if (stroke.length < 3 || !doc) { paint([]); return; }
    const hits = [];
    for (let i = 0; i < stroke.length; i++) {
      const a = stroke[i], b = stroke[i + 1] ?? a;
      const steps = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / 8));
      for (let s = 0; s < steps; s++) { const h = elementAt(a.x + ((b.x - a.x) * s) / steps, a.y + ((b.y - a.y) * s) / steps); if (h) hits.push(h); }
    }
    const first = stroke[0], last = stroke[stroke.length - 1];
    if (stroke.length > 12 && Math.hypot(last.x - first.x, last.y - first.y) < 60) {
      const xs = stroke.map((p) => p.x), ys = stroke.map((p) => p.y);
      const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
      for (let y = y0 + 10; y < y1; y += 24) for (let x = x0 + 10; x < x1; x += 24) if (inside({ x, y }, stroke)) { const h = elementAt(x, y); if (h) hits.push(h); }
    }
    const targets = innermost(hits);
    if (!targets.length) { paint([]); return; }
    draft = { kind: "pen", targets, anchorEl: elementAt(first.x, first.y) ?? targets[0], at: first, stroke };
    render();
  };
  pen.addEventListener("pointerup", finish);
  pen.addEventListener("pointercancel", finish);

  // ---------- pin picking inside the iframe ----------
  function elementAt(x, y) {
    if (!doc) return null;
    const e = doc.elementFromPoint(x, y);
    return e && e !== doc.body && e !== doc.documentElement ? e : null;
  }
  function outline(t) {
    if (!t) { hov.style.display = "none"; return; }
    const r = t.getBoundingClientRect();
    Object.assign(hov.style, { display: "block", left: `${r.left - 2}px`, top: `${r.top - 2}px`, width: `${r.width + 4}px`, height: `${r.height + 4}px` });
    const c = typeof t.className === "string" ? t.className.trim().split(/\s+/)[0] : "";
    hov.firstChild.textContent = `${t.tagName.toLowerCase()}${c ? `.${c}` : ""}`;
  }
  function attach() {
    try { doc = frame.contentDocument; } catch { doc = null; }
    if (!doc || doc.__aat) return;
    doc.__aat = true;
    cursorStyle = doc.createElement("style");
    cursorStyle.textContent = "html, html * { cursor: crosshair !important; }";
    doc.head.appendChild(cursorStyle);
    const cap = { capture: true };
    const picking = () => open && mode === "pin" && !draft;
    doc.addEventListener("mousemove", (e) => { if (picking()) outline(elementAt(e.clientX, e.clientY)); }, cap);
    for (const t of ["pointerdown", "mousedown", "pointerup", "mouseup", "dblclick", "contextmenu"]) {
      doc.addEventListener(t, (e) => { if (picking()) { e.preventDefault(); e.stopPropagation(); } }, cap);
    }
    doc.addEventListener("click", (e) => {
      if (!picking()) return;
      e.preventDefault(); e.stopPropagation();
      const t = elementAt(e.clientX, e.clientY);
      if (t) { draft = { kind: "pin", targets: [t], anchorEl: t, at: { x: e.clientX, y: e.clientY } }; outline(null); render(); }
    }, cap);
    doc.addEventListener("keydown", onKey, cap);
    doc.addEventListener("scroll", () => measurePins(), cap);
    render();
  }
  frame.addEventListener("load", attach);
  if (frame.contentDocument && frame.contentDocument.readyState === "complete") attach();

  // ---------- comment box ----------
  function renderComposer() {
    if (composer) { composer.remove(); composer = null; }
    if (!draft) return;
    const W = Math.min(300, stage.clientWidth - 24);
    const first = draft.targets[0];
    const count = innermost(draft.targets).length;
    const what = draft.kind === "pin"
      ? `<${first.tagName.toLowerCase()}>${oneLine(first.innerText) ? ` "${oneLine(first.innerText).slice(0, 40)}"` : ""}`
      : `${count} marked element${count === 1 ? "" : "s"}`;
    composer = el("div", "composer", `<div class="hd"><span class="n">${nextN()}</span><span></span><button type="button" class="x" aria-label="Cancel">${svg(icon.x, 14)}</button></div><textarea rows="3" placeholder="What should change here?" aria-label="What should change here?"></textarea><div class="ft">Enter to copy the prompt · Shift+Enter for a new line</div>`);
    composer.querySelector(".hd span:nth-child(2)").textContent = what;
    Object.assign(composer.style, { width: `${W}px`, left: `${Math.min(Math.max(12, draft.at.x + 14), stage.clientWidth - W - 60)}px`, top: `${Math.min(Math.max(12, draft.at.y + 14), stage.clientHeight - 170)}px` });
    composer.querySelector(".x").onclick = () => { draft = null; render(); };
    const ta = composer.querySelector("textarea");
    let busy = false;
    ta.addEventListener("keydown", async (k) => {
      if (k.key === "Escape") { k.preventDefault(); k.stopPropagation(); draft = null; render(); return; }
      if (k.key !== "Enter" || k.shiftKey || k.isComposing) return;
      k.preventDefault();
      const c = ta.value.trim();
      if (!c || busy) return;
      busy = true; ta.disabled = true;
      composer.querySelector(".ft").textContent = "Taking the screenshot…";
      await save(draft, c);
    });
    layer.append(composer);
    ta.focus({ preventScroll: true });
  }

  async function save(d, comment) {
    const els = innermost(d.targets).slice(0, 12);
    const section = d.kind === "pen" && els.length > 1 ? commonAncestor(els) : null;
    const id = `aat-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
    const ar = d.anchorEl.getBoundingClientRect();
    const blob = await captureMark(doc, els, d.stroke);
    if (blob) shots.set(id, blob);
    const note = {
      id, n: nextN(), kind: d.kind, url: doc.location.href, path: doc.location.pathname, title: doc.title,
      viewport: `${frame.clientWidth}x${frame.clientHeight}`, comment,
      elements: els.map(describe), section: section && section !== doc.body ? describe(section) : null,
      anchor: { selector: selectorFor(d.anchorEl), rx: ar.width ? (d.at.x - ar.left) / ar.width : 0.5, ry: ar.height ? (d.at.y - ar.top) / ar.height : 0.5 },
      createdAt: Date.now(),
    };
    notes = [...notes, note].slice(-MAX_NOTES);
    saveNotes();
    draft = null;
    const prompt = buildPrompt(note, Boolean(blob));
    showOutput(prompt, blob);
    const copied = await copyText(prompt);
    if (copied && blob) toast(`Note ${note.n} copied`, "Prompt copied. Copy the screenshot too and paste both into Claude.", "Copy image", () => copyImage(blob));
    else if (copied) toast(`Note ${note.n} copied`, "Prompt copied. Paste it into Claude.");
    else toast(`Note ${note.n} saved`, "The clipboard was blocked. Copy it from the notes list.", "Copy", () => copyText(prompt));
    render();
  }

  // ---------- output pane on the right ----------
  function showOutput(prompt, blob) {
    lastPrompt = prompt;
    if (out) out.textContent = prompt;
    if (copyTry) copyTry.disabled = false;
    if (outShot) {
      outShot.innerHTML = "";
      if (blob) {
        const img = el("img"); img.alt = "Screenshot of the marked spot with the mark drawn in red"; img.src = URL.createObjectURL(blob);
        const b = el("button", "copy", "Copy image"); b.type = "button";
        b.onclick = async () => { b.textContent = (await copyImage(blob)) ? "Copied" : "Blocked"; setTimeout(() => (b.textContent = "Copy image"), 1600); };
        outShot.append(img, b);
        outShot.hidden = false;
      } else outShot.hidden = true;
    }
  }
  if (copyTry) copyTry.onclick = async () => { copyTry.textContent = (await copyText(lastPrompt)) ? "Copied" : "Blocked"; setTimeout(() => (copyTry.textContent = "Copy"), 1600); };

  // ---------- toast ----------
  function toast(title, desc, actionLabel, action) {
    const t = el("div", "aat-toast", `<b></b><p></p>`);
    t.querySelector("b").textContent = title;
    t.querySelector("p").textContent = desc;
    if (actionLabel) { const b = el("button", "copy", actionLabel); b.type = "button"; b.onclick = action; t.append(b); }
    toastBox.innerHTML = ""; toastBox.append(t);
    setTimeout(() => t.remove(), 5000);
  }

  // ---------- notes panel ----------
  function renderPanel() {
    if (panelEl) { panelEl.remove(); panelEl = null; }
    if (!panel || !open) return;
    const path = doc ? doc.location.pathname : "";
    const here = notes.filter((x) => x.path === path);
    const list = (scope === "page" ? here : notes).slice().reverse();
    panelEl = el("div", "aat-panel", `<div class="hd"><b>AAT notes</b><div class="seg"><button type="button" data-s="page">This page ${here.length}</button><button type="button" data-s="all">All ${notes.length}</button></div><button type="button" class="x" aria-label="Close notes">${svg(icon.x, 15)}</button></div><div class="list"></div>`);
    panelEl.querySelectorAll(".seg button").forEach((b) => { b.classList.toggle("on", b.dataset.s === scope); b.onclick = () => { scope = b.dataset.s; renderPanel(); }; });
    panelEl.querySelector(".x").onclick = () => { panel = false; render(); };
    const box = panelEl.querySelector(".list");
    if (!list.length) box.append(el("div", "empty", "No notes yet. Use the pin or the pen to add one."));
    for (const x of list) {
      const row = el("div", "row", `<span class="n">${x.n}</span><div class="m"><div class="c"></div><div class="k"></div><div class="acts"></div></div>`);
      row.querySelector(".c").textContent = x.comment;
      row.querySelector(".k").textContent = `${x.kind === "pin" ? "Pin" : "Pen"} · ${x.elements.length} element${x.elements.length === 1 ? "" : "s"}${scope === "all" ? ` · ${x.path}` : ""}`;
      const acts = row.querySelector(".acts");
      const small = (html, fn, cls = "") => { const b = el("button", `sb ${cls}`, html); b.type = "button"; b.onclick = fn; acts.append(b); };
      small(`${svg(icon.copy, 12)} Copy prompt`, async () => { const p = buildPrompt(x, shots.has(x.id)); showOutput(p, shots.get(x.id)); toast(await copyText(p) ? `Note ${x.n} prompt copied` : "The clipboard was blocked", ""); });
      if (shots.has(x.id)) small(`${svg(icon.img, 12)} Copy image`, async () => toast(await copyImage(shots.get(x.id)) ? `Note ${x.n} screenshot copied` : "The clipboard was blocked", ""));
      small(svg(icon.trash, 12), () => { notes = notes.filter((y) => y.id !== x.id); saveNotes(); render(); }, "danger");
      box.append(row);
    }
    if (list.length) {
      const ft = el("div", "ft");
      const all = el("button", "dark", `${svg(icon.copy, 13)} Copy all as one prompt`); all.type = "button";
      all.onclick = async () => {
        const ordered = list.slice().reverse();
        const text = [`Here are ${ordered.length} AAT notes. Handle each one, in order.`, ...ordered.map((x) => buildPrompt(x, shots.has(x.id)))].join("\n\n----------\n\n");
        showOutput(text, null);
        toast(await copyText(text) ? `${ordered.length} note${ordered.length === 1 ? "" : "s"} copied as one prompt` : "The clipboard was blocked", "");
      };
      const clr = el("button", "clr", `Clear ${scope === "page" ? "this page" : "all"}`); clr.type = "button";
      clr.onclick = () => { const ids = list.map((x) => x.id); notes = notes.filter((x) => !ids.includes(x.id)); saveNotes(); render(); };
      ft.append(all, clr); panelEl.append(ft);
    }
    layer.append(panelEl);
  }

  // ---------- keys: Esc steps back ----------
  function onKey(e) {
    if (e.key !== "Escape" || !open) return;
    if (draft) draft = null;
    else if (mode !== "off") mode = "off";
    else if (panel) panel = false;
    else return;
    e.stopPropagation();
    render();
  }
  addEventListener("keydown", onKey, true);

  function render() {
    stage.classList.toggle("aat-pen-on", open && mode === "pen");
    if (cursorStyle) cursorStyle.disabled = !(open && mode === "pin" && !draft);
    if (!(open && mode === "pin") || draft) outline(draft && draft.kind === "pin" ? draft.targets[0] : null);
    paint(draft && draft.stroke ? draft.stroke : []);
    renderTray(); renderHint(); renderComposer(); renderPanel(); measurePins();
  }
  render();
})();
