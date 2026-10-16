---
name: admin-annotation-tool
description: Use when adding AAT (Admin Annotation Tool) to a web app, a floating admin-only tool that lets you pin a note on any element or circle things with a red pen, and turns each note into a ready prompt for a coding agent (exact elements, CSS selectors, React component names, current styles, plus a screenshot with the mark drawn on it). Built for Next.js App Router + React + Tailwind CSS v4. Trigger on "annotation tool", "AAT", "pin comments on the page", "visual feedback to Claude", "mark up the UI and get a prompt".
---

# AAT, the Admin Annotation Tool

A floating tray on the right edge of every page, visible only to admins. Pin a note on any element, or draw over things with a red pen, and each note becomes a plain-text prompt for a coding agent, copied to the clipboard, with a screenshot of the marked spot.

The files in `references/` are the working source from Leadian. The only changes from the original: the app name, storage keys and screenshot endpoint moved to `config.ts`; the theme colors are written as their exact hex values; the two custom animations live in `aat.css`; and the auth wiring is generic. **Copy the files as they are. Do not restyle, simplify or drop anything.** The design and every feature below must survive the port.

## Files

| Reference | Put it at | What it is |
|---|---|---|
| `components/aat/config.ts` | `src/components/aat/config.ts` | App name, storage prefix, screenshot endpoint. The only file meant to be edited. |
| `components/aat/aat.tsx` | `src/components/aat/aat.tsx` | The tray, pin picker, pen canvas, comment box, pins, notes panel. |
| `components/aat/aat.css` | `src/components/aat/aat.css` | Pop-in animation, thin scrollbar, pointer cursor. Imported by `aat.tsx`. |
| `components/aat/describe.ts` | `src/components/aat/describe.ts` | Turns DOM elements into facts (selector, React components, style) and builds the prompt. |
| `components/aat/shot.ts` | `src/components/aat/shot.ts` | Screenshot of the marked spot with the red mark drawn on top. |
| `components/aat/gate.tsx` | `src/components/aat/gate.tsx` | Admin gate. Lazy loads the tool only for admins and contains any error. |
| `app/api/dev/aat-shot/route.ts` | `src/app/api/dev/aat-shot/route.ts` | Localhost only route that saves screenshots to `.data/aat/`. |

## Steps

1. **Dependencies**: `npm i modern-screenshot lucide-react sonner`. A sonner `<Toaster />` must be mounted (the toasts carry the "Copy image" and "Copy" buttons). If the app already uses another toast library, keep sonner for AAT anyway; the pin picker lets clicks through to `[data-sonner-toaster]`.
2. **Copy** every reference file to the paths above. Fix only the import alias if the project does not use `@/`.
3. **Config**: set `appName` and `storagePrefix` in `config.ts`.
4. **Gate**: render `<AatGate ... />` once near the root, inside the providers. Two props:
   - `isAdmin`: pass it wherever the app already has the signed-in user. No extra request.
   - `checkAdmin`: an async function that asks the server "is this user an admin?". Used only on pages where the user is not loaded, and only when this browser has been an admin before (a localStorage hint), so visitors never trigger a request.
   Leave `isAdmin` undefined (not `false`) while the user is still loading, or the hint gets cleared.
5. **Screenshot route**: replace `isAdmin()` in `route.ts` with the project's real admin check. It returns `false` by default, so it stays locked until wired. Add `.data/` to `.gitignore`. If the app is hosted somewhere other than Netlify or Vercel, add that platform's env var to the first check. To skip saving files, set `shotEndpoint: ""` in the config and delete the route; the prompt then asks the admin to paste the image.
6. **Tailwind**: v4 is required (the classes use v4 opacity steps such as `bg-white/12`). Make sure Tailwind scans `src/components/aat/`. Nothing needs to be added to the theme: all colors are literal hex values.
7. **Component names**: `SKIP_COMPONENT` in `describe.ts` hides framework wrappers from the component chain. Add the project's own wrapper names only if they show up as noise. Do not remove the `^Aat` entry.

## Design (keep exactly)

- Tray: dark pill `#18181b`, fixed on the right edge, vertically centered, 36px round icon buttons (lucide icons at 17px), white active state, soft shadow and a `white/10` ring. Closed it shows one button (MessageSquareText); open it shows Pin (MapPin), Pen (PenLine), Notes (List, with a red count badge), a divider, Close (X).
- Mark color: red `#ef4444` everywhere (hover outline, label, pen stroke, pin dots, badges, screenshot mark).
- Pin hover: 2px red outline with a 7% red fill and a small red label `tag.firstClass`. Cursor is a crosshair over the whole page.
- Pen: 7px round stroke at 85% opacity on a full-screen canvas.
- Pin dots: 24px red circles with a white 2px border and the note number.
- Comment box: 340px white card, 14px radius, header with the number badge and what was marked, 3-row textarea "What should change here?", footer hint "Enter to copy the prompt · Shift+Enter for a new line", and a spinner "Taking the screenshot…" while saving. Pops in (`aat-pop`).
- Mode hint: dark pill at the top center, "Click any element to pin a note · Esc to stop" or "Draw over anything, release to comment · Esc to stop".
- Notes panel: 360px white card left of the tray, 16px radius, max 640px or 80vh tall, title "AAT notes", segmented "This page n / All n", each note with its number, comment, "Pin/Pen · n elements" (plus the path in All), buttons "Copy prompt", "Copy image" (when this visit has the image), delete; footer "Copy all as one prompt" and "Clear this page/all".
- Neutrals: text `#18181b` / `#52525b` / `#a1a1aa`, borders `#ececef` / `#e4e4e7`, chips `#f4f4f5`, panels `#fafafa`.
- Everything sits at z-index 2147483000 and up, rendered in a portal on `document.body`.

## Features (verify each one after installing)

1. Non-admins: nothing renders, the tool's code is never downloaded, no extra request on public pages.
2. Admin: the tray shows on every page.
3. Pin: hover outlines elements; the click is swallowed so links and buttons do not fire; the comment box opens at the click.
4. Enter saves and copies the prompt; Shift+Enter adds a line; Esc cancels.
5. Pen: the stroke collects every element it crosses; a closed loop (start and end within 60px) also takes the elements inside; only the innermost elements are kept (max 12).
6. Pen notes add a "Section that holds the marked elements" block (their shared parent).
7. The prompt lists page URL and title, viewport, and per element: tag and text, selector, React components (development only), attributes, classes, size and position, current style. It ends with the instruction to find the elements and change only what the comment asks.
8. Screenshot: cropped around the mark with 48px padding, the red box or stroke drawn on it. On localhost it is saved to `.data/aat/` and the prompt names the file; elsewhere the toast offers "Copy image". A failed screenshot never blocks the note.
9. If the clipboard is blocked, the toast says so and offers "Copy".
10. Pins reappear after reload on the same element and follow it through scroll and resize.
11. Notes panel: This page / All, Copy prompt, Copy image, delete, Copy all as one prompt (in order, separated), Clear.
12. Esc steps back one level at a time: comment box, then mode, then panel.
13. Notes persist in localStorage (last 200); nothing is sent anywhere except the localhost screenshot.
14. AAT never selects, outlines or screenshots its own UI.
15. An error inside AAT is logged as `[AAT] stopped:` and the page keeps working.

## Verify

Run the build, then the dev server. Sign in as an admin and walk through the feature list above on two or three pages, including one with scrolling content. Sign out and confirm nothing shows and no request is made. The browser console must be clean.

## Safety notes

- The screenshot route writes files, so it answers only on localhost or 127.0.0.1, never on Netlify or Vercel, only for admins, only PNG, only file names matching `aat-[a-z0-9-]{4,60}.png`, max 8 MB.
- The tool reads the page and never changes it.
