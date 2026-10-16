/**
 * AAT (Admin Annotation Tool): turns DOM elements into plain facts a coding agent can act on,
 * and builds the "prompt to Claude" from a note. Pure reads of the page; changes nothing.
 */

import { AAT_CONFIG } from "./config";

export type ElInfo = {
  tag: string;
  text: string;
  selector: string;
  components: string[];
  attrs: string[];
  classes: string;
  box: string;
  style: string[];
};

export type Note = {
  id: string;
  n: number;
  kind: "pin" | "pen";
  url: string;
  path: string;
  title: string;
  viewport: string;
  comment: string;
  elements: ElInfo[];
  section: ElInfo | null;
  /** Where the anchor pin sits: the element's selector and the click point as a fraction of its box. */
  anchor: { selector: string; rx: number; ry: number };
  /** Project-relative path of the saved screenshot (localhost only). */
  shotFile: string | null;
  createdAt: number;
};

/** Marks every AAT node, so the tool never annotates or screenshots itself. */
export const AAT_ATTR = "data-aat";
export const isAat = (n: Node | null) => n instanceof Element && Boolean(n.closest(`[${AAT_ATTR}]`));

const clip = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);
const oneLine = (s: string | null | undefined) => (s ?? "").replace(/\s+/g, " ").trim();

/** Ids that look generated (React useId, long random runs) are useless in a selector. */
const stableId = (id: string) => id && !/[:«»]|^r\d|[0-9a-f]{8,}/i.test(id);

export function selectorFor(el: Element): string {
  if (el.id && stableId(el.id) && document.querySelectorAll(`#${CSS.escape(el.id)}`).length === 1) return `#${CSS.escape(el.id)}`;
  const parts: string[] = [];
  let cur: Element | null = el;
  while (cur && cur !== document.body && cur !== document.documentElement && parts.length < 8) {
    if (cur.id && stableId(cur.id)) { parts.unshift(`#${CSS.escape(cur.id)}`); break; }
    const testId = cur.getAttribute("data-testid");
    if (testId) { parts.unshift(`[data-testid="${testId}"]`); break; }
    const tag = cur.tagName.toLowerCase();
    const parent: Element | null = cur.parentElement;
    const same = parent ? Array.from(parent.children).filter((c) => c.tagName === cur!.tagName) : [];
    parts.unshift(same.length > 1 ? `${tag}:nth-of-type(${same.indexOf(cur) + 1})` : tag);
    cur = parent;
  }
  if (cur === document.body) parts.unshift("body");
  return parts.join(" > ");
}

/** Next.js and library wrappers that say nothing about where the element lives in our code. */
const SKIP_COMPONENT = /Router|Boundary|Template|Handler|Provider|Fallback|^Segment|^Inner|^Outer|^Hot|^AppDev|^Server|^Root|^Head|^Suspense|^Fragment|^Link$|^Image$|^Script$|^Toaster$|^Aat/;

/** React component chain, innermost first. Only meaningful in development, where names are not minified. */
function componentsOf(el: Element): string[] {
  if (process.env.NODE_ENV !== "development") return [];
  const key = Object.keys(el).find((k) => k.startsWith("__reactFiber$"));
  type Fiber = { type?: unknown; return?: Fiber | null };
  let f = key ? ((el as unknown as Record<string, Fiber>)[key] ?? null) : null;
  const out: string[] = [];
  while (f && out.length < 5) {
    const t = f.type as { displayName?: string; name?: string; render?: { name?: string } } | string | undefined;
    if (t && typeof t !== "string") {
      const name = t.displayName || t.name || t.render?.name;
      if (name && /^[A-Z]/.test(name) && !SKIP_COMPONENT.test(name) && out[out.length - 1] !== name) out.push(name);
    }
    f = f.return ?? null;
  }
  return out;
}

function hex(rgb: string): string {
  const m = rgb.match(/rgba?\(([\d.]+),\s*([\d.]+),\s*([\d.]+)(?:,\s*([\d.]+))?\)/);
  if (!m) return rgb;
  const h = [m[1], m[2], m[3]].map((v) => Math.round(Number(v)).toString(16).padStart(2, "0")).join("");
  return m[4] !== undefined && Number(m[4]) < 1 ? `#${h} at ${Math.round(Number(m[4]) * 100)}% opacity` : `#${h}`;
}

function styleOf(el: Element): string[] {
  const s = getComputedStyle(el);
  const font = s.fontFamily.split(",")[0].replace(/["']/g, "").trim();
  const out = [`font: ${font} ${s.fontSize}, weight ${s.fontWeight}, line-height ${s.lineHeight}`, `color: ${hex(s.color)}`];
  if (!/rgba\(0, 0, 0, 0\)|transparent/.test(s.backgroundColor)) out.push(`background: ${hex(s.backgroundColor)}`);
  if (s.backgroundImage && s.backgroundImage !== "none") out.push(`background-image: ${clip(s.backgroundImage, 90)}`);
  if (s.padding !== "0px") out.push(`padding: ${s.padding}`);
  if (s.margin !== "0px") out.push(`margin: ${s.margin}`);
  if (s.borderRadius !== "0px") out.push(`radius: ${parseFloat(s.borderRadius) > 9999 ? "full (pill)" : s.borderRadius}`);
  if (s.borderTopWidth !== "0px" && s.borderTopStyle !== "none") out.push(`border: ${s.borderTopWidth} ${s.borderTopStyle} ${hex(s.borderTopColor)}`);
  if (s.display === "flex" || s.display === "grid") out.push(`layout: ${s.display}, gap ${s.gap}, align ${s.alignItems}, justify ${s.justifyContent}`);
  if (s.textAlign !== "start") out.push(`text-align: ${s.textAlign}`);
  return out;
}

export function describe(el: Element): ElInfo {
  const r = el.getBoundingClientRect();
  const attrs: string[] = [];
  for (const a of ["aria-label", "placeholder", "alt", "title", "href", "name", "type", "role", "src"]) {
    const v = el.getAttribute(a);
    if (v) attrs.push(`${a}="${clip(oneLine(v), 80)}"`);
  }
  return {
    tag: el.tagName.toLowerCase(),
    text: clip(oneLine((el as HTMLElement).innerText ?? el.textContent), 120),
    selector: selectorFor(el),
    components: componentsOf(el),
    attrs,
    classes: clip(oneLine(typeof el.className === "string" ? el.className : el.getAttribute("class")), 220),
    box: `${Math.round(r.width)}x${Math.round(r.height)}px at x ${Math.round(r.left + scrollX)}, y ${Math.round(r.top + scrollY)} (page)`,
    style: styleOf(el),
  };
}

/** Deepest real element under a viewport point, skipping AAT's own layers. */
export function elementAt(x: number, y: number): Element | null {
  for (const el of document.elementsFromPoint(x, y)) {
    if (isAat(el) || el === document.documentElement || el === document.body) continue;
    return el;
  }
  return null;
}

/** Keeps only the innermost elements: drops any element that contains another one in the list. */
export function innermost(els: Element[]): Element[] {
  const uniq = Array.from(new Set(els));
  return uniq.filter((a) => !uniq.some((b) => b !== a && a.contains(b)));
}

export function commonAncestor(els: Element[]): Element | null {
  if (!els.length) return null;
  let anc: Element | null = els[0];
  while (anc && !els.every((e) => anc!.contains(e))) anc = anc.parentElement;
  return anc;
}

function elBlock(e: ElInfo, label: string): string {
  const lines = [`${label}: <${e.tag}>${e.text ? ` "${e.text}"` : ""}`, `  Selector: ${e.selector}`];
  if (e.components.length) lines.push(`  React components (innermost first): ${e.components.join(" < ")}`);
  if (e.attrs.length) lines.push(`  Attributes: ${e.attrs.join(", ")}`);
  if (e.classes) lines.push(`  Classes: ${e.classes}`);
  lines.push(`  Size: ${e.box}`, `  Current style: ${e.style.join("; ")}`);
  return lines.join("\n");
}

export function buildPrompt(note: Note, shotLine: string): string {
  const head = note.kind === "pin"
    ? "I pinned one element on the page and wrote a comment about it."
    : `I marked an area of the page with a pen. The stroke went over ${note.elements.length} element${note.elements.length === 1 ? "" : "s"}.`;
  const parts = [
    `[AAT note ${note.n}] Change request for ${AAT_CONFIG.appName}`,
    "",
    head,
    "",
    `My comment: ${note.comment}`,
    "",
    `Page: ${note.url}${note.title ? ` ("${note.title}")` : ""}`,
    `Viewport: ${note.viewport}`,
    ...(shotLine ? [shotLine] : []),
    "",
    ...note.elements.map((e, i) => elBlock(e, note.elements.length === 1 ? "Element" : `Element ${i + 1}`)).flatMap((b) => [b, ""]),
  ];
  if (note.section) parts.push(elBlock(note.section, "Section that holds the marked elements"), "");
  parts.push(
    "Find these elements in the codebase (search for the visible text, the React component names and the classes), make the change my comment asks for, and keep everything else exactly as it is. If the comment is unclear, ask me before changing anything.",
  );
  return parts.join("\n");
}
