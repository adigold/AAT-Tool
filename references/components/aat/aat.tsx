"use client";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Copy, ImageIcon, List, Loader2, MapPin, MessageSquareText, PenLine, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { AAT_ATTR, buildPrompt, commonAncestor, describe, elementAt, innermost, selectorFor, type Note } from "./describe";
import { captureMark } from "./shot";
import { AAT_CONFIG } from "./config";
import "./aat.css";

/**
 * AAT (Admin Annotation Tool). A floating tool for admins on every page:
 * - Pin: click any element, write a comment, press Enter.
 * - Pen: draw over anything with a thick red marker; on release, comment on everything the stroke touched.
 * Each note becomes a ready "prompt to Claude" (copied to the clipboard) with the exact elements, their
 * selectors, React components and current styles, plus a screenshot with the mark drawn on it.
 * Notes are kept in this browser only. The tool never changes the page.
 */

type Pt = { x: number; y: number };
type Mode = "off" | "pin" | "pen";
type Draft = { kind: "pin" | "pen"; targets: Element[]; anchorEl: Element; at: Pt; stroke?: Pt[] };

const STORE = `${AAT_CONFIG.storagePrefix}.notes`;
const MAX_NOTES = 200;
const Z = 2147483000;
const RED = "#ef4444";
const aatProps = { [AAT_ATTR]: "" };
const isLocal = () => ["localhost", "127.0.0.1"].includes(location.hostname);

function loadNotes(): Note[] {
  try { const v = JSON.parse(localStorage.getItem(STORE) ?? "[]"); return Array.isArray(v) ? v : []; } catch { return []; }
}
function saveNotes(notes: Note[]) {
  try { localStorage.setItem(STORE, JSON.stringify(notes.slice(-MAX_NOTES))); } catch {}
}

const shotLine = (n: Note, hasImage: boolean) =>
  n.shotFile ? `Screenshot of the marked spot, with my mark drawn in red: ${n.shotFile}`
    : hasImage ? "Screenshot: I am pasting an image of the marked spot (my mark drawn in red) with this prompt." : "";

async function copyText(text: string): Promise<boolean> {
  try { await navigator.clipboard.writeText(text); return true; } catch { return false; }
}
async function copyImage(blob: Blob): Promise<boolean> {
  try { await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]); return true; } catch { return false; }
}

export function Aat() {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<Mode>("off");
  // Client only (the gate loads this with ssr: false), so the browser's saved notes can be read up front.
  const [notes, setNotes] = useState<Note[]>(loadNotes);
  const [panel, setPanel] = useState(false);
  const [draft, setDraft] = useState<Draft | null>(null);
  /** Screenshots of this visit's notes (images are not saved in the browser, only their file path on localhost). */
  const [shots, setShots] = useState<Map<string, Blob>>(() => new Map());

  const update = useCallback((fn: (n: Note[]) => Note[]) => setNotes((cur) => { const next = fn(cur); saveNotes(next); return next; }), []);

  // Esc steps back: draft, then mode, then the tray.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (draft) setDraft(null);
      else if (mode !== "off") setMode("off");
      else if (panel) setPanel(false);
      else return;
      e.stopPropagation();
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [open, draft, mode, panel]);

  const save = useCallback(async (d: Draft, comment: string) => {
    const els = innermost(d.targets).slice(0, 12);
    const section = d.kind === "pen" && els.length > 1 ? commonAncestor(els) : null;
    const id = `aat-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
    const ar = d.anchorEl.getBoundingClientRect();
    const blob = await captureMark({ targets: els, stroke: d.stroke });
    let shotFile: string | null = null;
    if (blob && AAT_CONFIG.shotEndpoint && isLocal()) {
      try {
        const r = await fetch(`${AAT_CONFIG.shotEndpoint}?name=${id}.png`, { method: "POST", body: blob });
        if (r.ok) shotFile = ((await r.json()) as { file: string }).file;
      } catch {}
    }
    if (blob) setShots((cur) => new Map(cur).set(id, blob));
    const note: Note = {
      id,
      n: notes.reduce((m, x) => Math.max(m, x.n), 0) + 1,
      kind: d.kind,
      url: location.href,
      path: location.pathname,
      title: document.title,
      viewport: `${innerWidth}x${innerHeight}`,
      comment,
      elements: els.map(describe),
      section: section && section !== document.body ? describe(section) : null,
      anchor: { selector: selectorFor(d.anchorEl), rx: ar.width ? (d.at.x - ar.left) / ar.width : 0.5, ry: ar.height ? (d.at.y - ar.top) / ar.height : 0.5 },
      shotFile,
      createdAt: Date.now(),
    };
    update((cur) => [...cur, note]);
    setDraft(null);
    const prompt = buildPrompt(note, shotLine(note, Boolean(blob)));
    const copied = await copyText(prompt);
    if (copied && blob && !shotFile) {
      toast.success(`Note ${note.n} copied`, { description: "Prompt copied. Copy the screenshot too and paste both into Claude.", action: { label: "Copy image", onClick: () => void copyImage(blob) } });
    } else if (copied) {
      toast.success(`Note ${note.n} copied`, { description: shotFile ? "Prompt copied, with the screenshot saved in the project. Paste it into Claude." : "Prompt copied. Paste it into Claude." });
    } else {
      toast(`Note ${note.n} saved`, { description: "The clipboard was blocked. Copy it from the notes list.", action: { label: "Copy", onClick: () => void copyText(prompt) } });
    }
  }, [notes, update]);

  const choose = (m: Mode) => { setDraft(null); setMode((cur) => (cur === m ? "off" : m)); };
  const close = () => { setDraft(null); setMode("off"); setPanel(false); setOpen(false); };
  const here = notes.filter((n) => n.path === (typeof location === "undefined" ? "" : location.pathname));

  return createPortal(
    <div {...aatProps} style={{ position: "relative", zIndex: Z }}>
      {open && mode === "pin" && !draft && <PinPicker onPick={(el, at) => setDraft({ kind: "pin", targets: [el], anchorEl: el, at })} />}
      {open && mode === "pen" && <PenLayer locked={Boolean(draft)} keep={draft?.stroke} onStroke={(stroke, targets, anchorEl) => setDraft({ kind: "pen", targets, anchorEl, at: stroke[0], stroke })} />}
      {open && <Pins notes={here} onOpen={() => setPanel(true)} />}
      {draft && <Composer draft={draft} n={notes.reduce((m, x) => Math.max(m, x.n), 0) + 1} onCancel={() => setDraft(null)} onSave={(c) => save(draft, c)} />}
      {panel && open && <NotesPanel notes={notes} here={here} shots={shots} onDelete={(id) => update((cur) => cur.filter((n) => n.id !== id))} onClear={(ids) => update((cur) => cur.filter((n) => !ids.includes(n.id)))} onClose={() => setPanel(false)} />}

      <div className="fixed right-3 top-1/2 flex -translate-y-1/2 flex-col items-center gap-1 rounded-full bg-[#18181b] p-1 text-white shadow-[0_10px_30px_-10px_rgba(0,0,0,.45)] ring-1 ring-white/10" style={{ zIndex: Z + 3 }}>
        {!open ? (
          <TrayBtn label="Admin Annotation Tool" onClick={() => setOpen(true)}><MessageSquareText size={17} /></TrayBtn>
        ) : (
          <>
            <TrayBtn label="Pin an element" active={mode === "pin"} onClick={() => choose("pin")}><MapPin size={17} /></TrayBtn>
            <TrayBtn label="Draw with the pen" active={mode === "pen"} onClick={() => choose("pen")}><PenLine size={17} /></TrayBtn>
            <TrayBtn label="Notes" active={panel} onClick={() => setPanel((p) => !p)}>
              <List size={17} />
              {notes.length > 0 && <span className="absolute -right-0.5 -top-0.5 grid h-4 min-w-4 place-items-center rounded-full px-1 text-[10px] font-semibold text-white" style={{ background: RED }}>{notes.length}</span>}
            </TrayBtn>
            <span className="my-0.5 h-px w-5 bg-white/15" />
            <TrayBtn label="Close AAT" onClick={close}><X size={17} /></TrayBtn>
          </>
        )}
      </div>
      {open && mode !== "off" && !draft && (
        <div className="pointer-events-none fixed left-1/2 top-3 -translate-x-1/2 rounded-full bg-[#18181b] px-3.5 py-1.5 text-[12px] font-medium text-white shadow-lg" style={{ zIndex: Z + 3 }}>
          {mode === "pin" ? "Click any element to pin a note" : "Draw over anything, release to comment"} · Esc to stop
        </div>
      )}
    </div>,
    document.body,
  );
}

function TrayBtn({ label, active, onClick, children }: { label: string; active?: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" title={label} aria-label={label} aria-pressed={active} onClick={onClick}
      className={`relative grid h-9 w-9 place-items-center rounded-full transition-colors ${active ? "bg-white text-[#18181b]" : "text-white/85 hover:bg-white/12 hover:text-white"}`}>
      {children}
    </button>
  );
}

/** Pin mode: outlines the element under the mouse and swallows the click so the page does not react. */
function PinPicker({ onPick }: { onPick: (el: Element, at: Pt) => void }) {
  const [box, setBox] = useState<{ r: DOMRect; label: string } | null>(null);
  const pick = useRef(onPick);
  useLayoutEffect(() => { pick.current = onPick; });
  useEffect(() => {
    const style = document.createElement("style");
    style.textContent = "html, html * { cursor: crosshair !important; }";
    document.head.appendChild(style);
    // AAT's own controls and the toasts (their "Copy image" button) keep working while picking.
    const isUi = (e: Event) => e.target instanceof Element && Boolean(e.target.closest(`[${AAT_ATTR}], [data-sonner-toaster]`));
    const move = (e: MouseEvent) => {
      if (isUi(e)) { setBox(null); return; }
      const el = elementAt(e.clientX, e.clientY);
      if (!el) { setBox(null); return; }
      const cls = typeof el.className === "string" ? el.className.trim().split(/\s+/)[0] : "";
      setBox({ r: el.getBoundingClientRect(), label: `${el.tagName.toLowerCase()}${cls ? `.${cls}` : ""}` });
    };
    const block = (e: Event) => { if (isUi(e)) return; e.preventDefault(); e.stopPropagation(); };
    const click = (e: MouseEvent) => {
      if (isUi(e)) return;
      e.preventDefault();
      e.stopPropagation();
      const el = elementAt(e.clientX, e.clientY);
      if (el) pick.current(el, { x: e.clientX, y: e.clientY });
    };
    const opts = { capture: true };
    document.addEventListener("mousemove", move, opts);
    for (const t of ["pointerdown", "mousedown", "pointerup", "mouseup", "dblclick", "contextmenu"]) document.addEventListener(t, block, opts);
    document.addEventListener("click", click, opts);
    return () => {
      style.remove();
      document.removeEventListener("mousemove", move, opts);
      for (const t of ["pointerdown", "mousedown", "pointerup", "mouseup", "dblclick", "contextmenu"]) document.removeEventListener(t, block, opts);
      document.removeEventListener("click", click, opts);
    };
  }, []);
  if (!box) return null;
  return (
    <div className="pointer-events-none fixed rounded-[3px]" style={{ zIndex: Z + 1, left: box.r.left - 2, top: box.r.top - 2, width: box.r.width + 4, height: box.r.height + 4, outline: `2px solid ${RED}`, background: "rgba(239,68,68,.07)" }}>
      <span className="absolute -top-5 left-0 whitespace-nowrap rounded px-1.5 py-px text-[10px] font-medium text-white" style={{ background: RED }}>{box.label}</span>
    </div>
  );
}

/** Pen mode: a full-screen canvas for a thick red stroke. On release, finds every element the stroke touched. */
function PenLayer({ locked, keep, onStroke }: { locked: boolean; keep?: Pt[]; onStroke: (stroke: Pt[], targets: Element[], anchorEl: Element) => void }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const pts = useRef<Pt[]>([]);
  const drawing = useRef(false);

  const paint = useCallback((list: Pt[]) => {
    const c = ref.current;
    const g = c?.getContext("2d");
    if (!c || !g) return;
    const dpr = window.devicePixelRatio || 1;
    if (c.width !== innerWidth * dpr || c.height !== innerHeight * dpr) { c.width = innerWidth * dpr; c.height = innerHeight * dpr; }
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, innerWidth, innerHeight);
    if (list.length < 1) return;
    g.strokeStyle = RED;
    g.globalAlpha = 0.85;
    g.lineWidth = 7;
    g.lineCap = "round";
    g.lineJoin = "round";
    g.beginPath();
    list.forEach((p, i) => (i ? g.lineTo(p.x, p.y) : g.moveTo(p.x, p.y)));
    g.stroke();
  }, []);

  // After a note is saved or cancelled, the kept stroke goes away.
  useEffect(() => { paint(keep ?? []); }, [keep, paint]);

  const finish = () => {
    if (!drawing.current) return;
    drawing.current = false;
    const stroke = pts.current;
    if (stroke.length < 3) { paint([]); return; }
    const c = ref.current!;
    c.style.pointerEvents = "none";
    const hits: Element[] = [];
    for (let i = 0; i < stroke.length; i++) {
      const a = stroke[i], b = stroke[i + 1] ?? a;
      const steps = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / 8));
      for (let s = 0; s < steps; s++) {
        const el = elementAt(a.x + ((b.x - a.x) * s) / steps, a.y + ((b.y - a.y) * s) / steps);
        if (el) hits.push(el);
      }
    }
    // A closed loop also takes the elements inside it.
    const first = stroke[0], last = stroke[stroke.length - 1];
    if (stroke.length > 12 && Math.hypot(last.x - first.x, last.y - first.y) < 60) {
      const xs = stroke.map((p) => p.x), ys = stroke.map((p) => p.y);
      const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
      for (let y = y0 + 10; y < y1; y += 24) for (let x = x0 + 10; x < x1; x += 24) {
        if (inside({ x, y }, stroke)) { const el = elementAt(x, y); if (el) hits.push(el); }
      }
    }
    c.style.pointerEvents = "";
    const targets = innermost(hits);
    if (!targets.length) { paint([]); return; }
    // The saved pin sits where the stroke started, on the element under that point.
    onStroke(stroke, targets, elementAt(first.x, first.y) ?? targets[0]);
  };

  return (
    <canvas ref={ref} className="fixed inset-0 h-screen w-screen touch-none"
      style={{ zIndex: Z + 1, cursor: "crosshair", pointerEvents: locked ? "none" : "auto" }}
      onPointerDown={(e) => { if (locked) return; e.currentTarget.setPointerCapture(e.pointerId); drawing.current = true; pts.current = [{ x: e.clientX, y: e.clientY }]; paint(pts.current); }}
      onPointerMove={(e) => { if (!drawing.current) return; pts.current.push({ x: e.clientX, y: e.clientY }); paint(pts.current); }}
      onPointerUp={finish}
      onPointerCancel={finish} />
  );
}

function inside(p: Pt, poly: Pt[]): boolean {
  let hit = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i], b = poly[j];
    if ((a.y > p.y) !== (b.y > p.y) && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x) hit = !hit;
  }
  return hit;
}

/** The comment box. Enter saves and copies the prompt; Shift+Enter adds a line; Esc cancels. */
function Composer({ draft, n, onSave, onCancel }: { draft: Draft; n: number; onSave: (comment: string) => Promise<void>; onCancel: () => void }) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const W = 340;
  const left = Math.min(Math.max(12, draft.at.x + 14), innerWidth - W - 60);
  const top = Math.min(Math.max(12, draft.at.y + 14), innerHeight - 190);
  const first = draft.targets[0];
  const what = draft.kind === "pin"
    ? `<${first.tagName.toLowerCase()}>${(first as HTMLElement).innerText ? ` "${(first as HTMLElement).innerText.trim().slice(0, 40)}"` : ""}`
    : `${innermost(draft.targets).length} marked element${innermost(draft.targets).length === 1 ? "" : "s"}`;
  const submit = async () => {
    const c = text.trim();
    if (!c || busy) return;
    setBusy(true);
    try { await onSave(c); } finally { setBusy(false); }
  };
  return (
    <>
      {draft.kind === "pin" && <PinDot x={draft.at.x} y={draft.at.y} n={n} />}
      <div className="fixed aat-pop overflow-hidden rounded-[14px] border border-[#ececef] bg-white text-[#18181b] shadow-[0_18px_50px_-18px_rgba(24,24,27,.45)]" style={{ zIndex: Z + 2, left, top, width: W }}>
        <div className="flex items-center gap-2 border-b border-[#ececef] px-3 py-2 text-[12px] text-[#52525b]">
          <span className="grid h-5 min-w-5 place-items-center rounded-full px-1 text-[10px] font-semibold text-white" style={{ background: RED }}>{n}</span>
          <span className="truncate">{what}</span>
          <button type="button" onClick={onCancel} aria-label="Cancel" className="ml-auto grid h-6 w-6 place-items-center rounded-md text-[#a1a1aa] hover:bg-[#f4f4f5] hover:text-[#18181b]"><X size={14} /></button>
        </div>
        <textarea autoFocus value={text} disabled={busy} onChange={(e) => setText(e.target.value)} rows={3}
          placeholder="What should change here?"
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); void submit(); }
            if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); onCancel(); }
          }}
          className="block w-full resize-none px-3 py-2.5 text-[13.5px] leading-5 outline-none placeholder:text-[#a1a1aa] disabled:bg-[#fafafa]" />
        <div className="flex items-center justify-between border-t border-[#ececef] bg-[#fafafa] px-3 py-1.5 text-[11px] text-[#a1a1aa]">
          {busy ? <span className="flex items-center gap-1.5 text-[#52525b]"><Loader2 size={12} className="animate-spin" /> Taking the screenshot…</span> : <span>Enter to copy the prompt · Shift+Enter for a new line</span>}
        </div>
      </div>
    </>
  );
}

function PinDot({ x, y, n, onClick }: { x: number; y: number; n: number; onClick?: () => void }) {
  return (
    <button type="button" onClick={onClick} title={`Note ${n}`}
      className="fixed grid h-6 w-6 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border-2 border-white text-[11px] font-semibold text-white shadow-[0_4px_12px_rgba(239,68,68,.45)]"
      style={{ zIndex: Z + 1, left: x, top: y, background: RED, pointerEvents: onClick ? "auto" : "none" }}>
      {n}
    </button>
  );
}

/** Saved notes on this page, as numbered pins that follow their element through scrolling and resizing. */
function Pins({ notes, onOpen }: { notes: Note[]; onOpen: () => void }) {
  const [spots, setSpots] = useState<{ id: string; n: number; x: number; y: number }[]>([]);
  useEffect(() => {
    let raf = 0;
    const measure = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const out: { id: string; n: number; x: number; y: number }[] = [];
        for (const note of notes) {
          let el: Element | null = null;
          try { el = document.querySelector(note.anchor.selector); } catch {}
          if (!el) continue;
          const r = el.getBoundingClientRect();
          if (!r.width && !r.height) continue;
          out.push({ id: note.id, n: note.n, x: r.left + r.width * note.anchor.rx, y: r.top + r.height * note.anchor.ry });
        }
        setSpots(out);
      });
    };
    measure();
    const t = setInterval(measure, 1000);
    window.addEventListener("scroll", measure, true);
    window.addEventListener("resize", measure);
    return () => { cancelAnimationFrame(raf); clearInterval(t); window.removeEventListener("scroll", measure, true); window.removeEventListener("resize", measure); };
  }, [notes]);
  return <>{spots.map((s) => <PinDot key={s.id} x={s.x} y={s.y} n={s.n} onClick={onOpen} />)}</>;
}

function NotesPanel({ notes, here, shots, onDelete, onClear, onClose }: {
  notes: Note[]; here: Note[]; shots: Map<string, Blob>; onDelete: (id: string) => void; onClear: (ids: string[]) => void; onClose: () => void;
}) {
  const [scope, setScope] = useState<"page" | "all">("page");
  const list = (scope === "page" ? here : notes).slice().reverse();
  const promptOf = (n: Note) => buildPrompt(n, shotLine(n, shots.has(n.id)));
  const copyAll = async () => {
    const ordered = list.slice().reverse();
    const text = [`Here are ${ordered.length} AAT notes. Handle each one, in order.`, ...ordered.map(promptOf)].join("\n\n----------\n\n");
    if (await copyText(text)) toast.success(`${ordered.length} note${ordered.length === 1 ? "" : "s"} copied as one prompt`);
    else toast.error("The clipboard was blocked");
  };
  return (
    <div className="fixed right-[60px] top-1/2 flex max-h-[min(640px,80vh)] w-[360px] -translate-y-1/2 aat-pop flex-col overflow-hidden rounded-[16px] border border-[#ececef] bg-white text-[#18181b] shadow-[0_24px_60px_-20px_rgba(24,24,27,.45)]" style={{ zIndex: Z + 2 }}>
      <div className="flex items-center gap-2 border-b border-[#ececef] px-4 py-3">
        <div className="text-[14px] font-semibold">AAT notes</div>
        <div className="ml-auto flex rounded-[9px] bg-[#f4f4f5] p-0.5 text-[12px]">
          {(["page", "all"] as const).map((s) => (
            <button key={s} type="button" onClick={() => setScope(s)} className={`rounded-[7px] px-2.5 py-1 font-medium transition-colors ${scope === s ? "bg-white text-[#18181b] shadow-sm" : "text-[#52525b] hover:text-[#18181b]"}`}>
              {s === "page" ? `This page ${here.length}` : `All ${notes.length}`}
            </button>
          ))}
        </div>
        <button type="button" onClick={onClose} aria-label="Close notes" className="grid h-7 w-7 place-items-center rounded-md text-[#a1a1aa] hover:bg-[#f4f4f5] hover:text-[#18181b]"><X size={15} /></button>
      </div>
      <div className="aat-scroll min-h-0 flex-1 overflow-y-auto">
        {list.length === 0 && <div className="px-4 py-10 text-center text-[13px] text-[#a1a1aa]">No notes yet. Use the pin or the pen to add one.</div>}
        {list.map((n) => (
          <div key={n.id} className="group border-b border-[#ececef] px-4 py-3 last:border-b-0">
            <div className="flex items-start gap-2.5">
              <span className="mt-px grid h-5 min-w-5 place-items-center rounded-full px-1 text-[10px] font-semibold text-white" style={{ background: RED }}>{n.n}</span>
              <div className="min-w-0 flex-1">
                <div className="text-[13px] leading-5 text-[#18181b]">{n.comment}</div>
                <div className="mt-0.5 truncate text-[11.5px] text-[#a1a1aa]">
                  {n.kind === "pin" ? "Pin" : "Pen"} · {n.elements.length} element{n.elements.length === 1 ? "" : "s"}{scope === "all" ? ` · ${n.path}` : ""}
                </div>
              </div>
            </div>
            <div className="mt-2 flex gap-1.5 pl-[30px]">
              <SmallBtn onClick={async () => toast[(await copyText(promptOf(n))) ? "success" : "error"](`Note ${n.n} prompt copied`)}><Copy size={12} /> Copy prompt</SmallBtn>
              {shots.has(n.id) && <SmallBtn onClick={async () => toast[(await copyImage(shots.get(n.id)!)) ? "success" : "error"](`Note ${n.n} screenshot copied`)}><ImageIcon size={12} /> Copy image</SmallBtn>}
              <SmallBtn onClick={() => onDelete(n.id)} danger><Trash2 size={12} /></SmallBtn>
            </div>
          </div>
        ))}
      </div>
      {list.length > 0 && (
        <div className="flex items-center gap-2 border-t border-[#ececef] bg-[#fafafa] px-4 py-2.5">
          <button type="button" onClick={copyAll} className="inline-flex items-center gap-1.5 rounded-[9px] bg-[#18181b] px-3 py-1.5 text-[12.5px] font-medium text-white hover:bg-black"><Copy size={13} /> Copy all as one prompt</button>
          <button type="button" onClick={() => onClear(list.map((n) => n.id))} className="ml-auto text-[12px] text-[#a1a1aa] hover:text-[#18181b]">Clear {scope === "page" ? "this page" : "all"}</button>
        </div>
      )}
    </div>
  );
}

function SmallBtn({ onClick, danger, children }: { onClick: () => void; danger?: boolean; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick}
      className={`inline-flex items-center gap-1 rounded-[8px] border border-[#ececef] px-2 py-1 text-[11.5px] font-medium transition-colors ${danger ? "text-[#a1a1aa] hover:border-red-200 hover:bg-red-50 hover:text-red-600" : "text-[#52525b] hover:border-[#e4e4e7] hover:bg-[#fafafa] hover:text-[#18181b]"}`}>
      {children}
    </button>
  );
}
