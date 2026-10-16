import { isAat } from "./describe";

type Pt = { x: number; y: number };
type Rect = { left: number; top: number; right: number; bottom: number };

const PAD = 48;
const MAX_AREA = 2400 * 1800;

/**
 * Screenshot of the marked spot, with the mark drawn in red on top: a box around a pinned element,
 * or the pen stroke itself. Captures the smallest page element that covers the spot, then crops.
 * Returns null on any failure; a missing image never blocks the note.
 */
export async function captureMark(opts: { targets: Element[]; stroke?: Pt[] }): Promise<Blob | null> {
  try {
    const { domToCanvas } = await import("modern-screenshot");
    const markRect = bounds(opts.stroke?.length ? opts.stroke.map((p) => ({ left: p.x, top: p.y, right: p.x, bottom: p.y })) : opts.targets.map(rectOf));
    const want = { left: markRect.left - PAD, top: markRect.top - PAD, right: markRect.right + PAD, bottom: markRect.bottom + PAD };

    // Climb from the targets' shared parent until one element covers the padded spot (or gets too big).
    let host: Element | null = shared(opts.targets);
    while (host && host.parentElement && host !== document.body) {
      const r = host.getBoundingClientRect();
      if (r.left <= want.left && r.top <= want.top && r.right >= want.right && r.bottom >= want.bottom) break;
      const pr = host.parentElement.getBoundingClientRect();
      if (pr.width * pr.height > MAX_AREA) break;
      host = host.parentElement;
    }
    if (!host) return null;
    const hr = host.getBoundingClientRect();
    const scale = Math.min(2, window.devicePixelRatio || 1);
    const full = await domToCanvas(host, {
      scale,
      backgroundColor: "#ffffff",
      timeout: 8000,
      filter: (n) => !isAat(n),
    });
    const k = full.width / Math.max(1, hr.width);

    // Crop to the padded spot, inside the captured element.
    const cx = Math.max(0, want.left - hr.left), cy = Math.max(0, want.top - hr.top);
    const cw = Math.min(hr.width, want.right - hr.left) - cx, ch = Math.min(hr.height, want.bottom - hr.top) - cy;
    if (cw < 4 || ch < 4) return null;
    const out = document.createElement("canvas");
    out.width = Math.round(cw * k);
    out.height = Math.round(ch * k);
    const g = out.getContext("2d");
    if (!g) return null;
    g.drawImage(full, cx * k, cy * k, cw * k, ch * k, 0, 0, out.width, out.height);

    // The red mark, in the cropped canvas's coordinates.
    const ox = hr.left + cx, oy = hr.top + cy;
    g.strokeStyle = "#ef4444";
    g.lineCap = "round";
    g.lineJoin = "round";
    g.lineWidth = 5 * k;
    if (opts.stroke?.length) {
      g.beginPath();
      opts.stroke.forEach((p, i) => (i ? g.lineTo((p.x - ox) * k, (p.y - oy) * k) : g.moveTo((p.x - ox) * k, (p.y - oy) * k)));
      g.stroke();
    } else {
      const r = markRect;
      g.lineWidth = 3 * k;
      g.beginPath();
      g.roundRect((r.left - ox - 4) * k, (r.top - oy - 4) * k, (r.right - r.left + 8) * k, (r.bottom - r.top + 8) * k, 6 * k);
      g.stroke();
    }
    return await new Promise((res) => out.toBlob((b) => res(b), "image/png"));
  } catch {
    return null;
  }
}

function rectOf(el: Element): Rect {
  const r = el.getBoundingClientRect();
  return { left: r.left, top: r.top, right: r.right, bottom: r.bottom };
}

function bounds(rs: Rect[]): Rect {
  return rs.reduce((a, r) => ({ left: Math.min(a.left, r.left), top: Math.min(a.top, r.top), right: Math.max(a.right, r.right), bottom: Math.max(a.bottom, r.bottom) }),
    { left: Infinity, top: Infinity, right: -Infinity, bottom: -Infinity });
}

function shared(els: Element[]): Element | null {
  if (!els.length) return document.body;
  let anc: Element | null = els[0];
  while (anc && !els.every((e) => anc!.contains(e))) anc = anc.parentElement;
  return anc ?? document.body;
}
