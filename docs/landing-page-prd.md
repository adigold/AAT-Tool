# PRD: AAT landing page (one pager)

Use this whole file as the prompt for designing and building the page.

## 1. What to build

A single, minimalist landing page for **AAT, the Admin Annotation Tool**, an open-source tool for Next.js apps. The page explains what AAT does in under a minute and sends visitors to the GitHub repo.

One page, no navigation menu beyond a top bar, no sign-up, no pricing, no blog. Static, fast, responsive, works at 375px wide with no horizontal scroll.

## 2. Who it is for

Developers and founders who build web apps with AI coding agents (Claude Code, Cursor, Codex). Their pain: describing a UI change in words is slow and vague ("the button on the right, no, the other one"). AAT lets them point at the live page instead.

## 3. The one message

**Point at your app. Get a prompt your coding agent can act on.**

Every section supports that sentence. If a section does not, cut it.

## 4. Page structure and copy

The copy below is a draft and may be tightened, but every factual claim must stay true to the feature list in section 6. Do not add features, numbers, logos, testimonials or user counts that are not in this file.

### 4.1 Top bar
- Left: wordmark "AAT" with a small red dot (`#ef4444`).
- Right: one link, "GitHub" with the GitHub icon, pointing to `{{GITHUB_URL}}`.

### 4.2 Hero
- Headline: "Point at your app. Get a prompt your coding agent can act on."
- Subline: "AAT is a tiny floating tool for admins. Pin a note on any element, or circle things with a red pen. Each note becomes a ready prompt with the exact elements, selectors, React components, styles and a marked screenshot."
- Primary button: "View on GitHub" → `{{GITHUB_URL}}`.
- Secondary text link: "How it works" → scrolls to 4.3.
- Visual: a looping screen recording (MP4 or WebM, muted, autoplay, no controls, with a static poster image) of AAT on a sample app: open the tray, pin a button, type "Make this button bigger", press Enter, toast "Note 1 copied". Placeholder until recorded: a browser frame mockup with the dark tray on the right edge and one red numbered pin.

### 4.3 How it works (three steps, side by side on desktop, stacked on mobile)
1. **Pin or draw.** "Click any element to pin a note, or draw over an area with the red pen. A closed loop takes everything inside it."
2. **Write what should change.** "Type your comment and press Enter."
3. **Paste into your agent.** "The prompt is already on your clipboard, with a screenshot of the spot and your mark drawn in red."

Each step gets a small illustration or a short silent clip.

### 4.4 What the prompt looks like
A code block (monospace, light gray panel) showing a real example of the output. Use this text exactly, it matches what the tool produces:

```text
[AAT note 1] Change request for my app

I pinned one element on the page and wrote a comment about it.

My comment: Make this button bigger and use our brand color

Page: http://localhost:3000/pricing ("Pricing")
Viewport: 1440x900
Screenshot of the marked spot, with my mark drawn in red: .data/aat/aat-m2x9k1-4f2a.png

Element: <button> "Start free trial"
  Selector: main > section:nth-of-type(2) > div > button
  React components (innermost first): Button < PricingCard < PricingPage
  Attributes: type="button"
  Classes: rounded-lg bg-zinc-900 px-4 py-2 text-sm text-white
  Size: 148x36px at x 812, y 640 (page)
  Current style: font: Inter 14px, weight 500, line-height 20px; color: #ffffff; background: #18181b; padding: 8px 16px; radius: 8px

Find these elements in the codebase (search for the visible text, the React component names and the classes), make the change my comment asks for, and keep everything else exactly as it is. If the comment is unclear, ask me before changing anything.
```

Caption under it: "No more 'the button on the right, no, the other one'."

### 4.5 Features (a simple grid, 6 items, icon + title + one line)
- **Pin and pen.** Pin one element, or draw over many.
- **Agent-ready prompts.** Selectors, React components, classes and current styles, in plain text.
- **Marked screenshots.** Cropped around your mark, saved into your project on localhost.
- **Pins that stay put.** Notes reappear on their element after reload and follow it while scrolling.
- **Batch it.** Copy every note on a page, or all of them, as one prompt.
- **Safe by design.** Admin only, never downloaded by visitors, never changes your page, notes stay in your browser.

### 4.6 Install
- Title: "Add it in one sentence"
- Text: "AAT ships as a Claude Code skill. Copy it into your skills folder and ask Claude Code to add it."
- Code block:
  ```bash
  git clone {{GITHUB_URL}} ~/.claude/skills/admin-annotation-tool
  ```
  then: `"Add AAT to this app"`
- Small line under it: "Prefer doing it by hand? Follow SKILL.md in the repo. Requires Next.js App Router, React and Tailwind CSS v4."

### 4.7 Footer
- "Open source, MIT license." · "GitHub" link · "Made by Adi Goldstein" linking to `{{AUTHOR_URL}}`.

## 5. Design direction

Minimalist and quiet, the page should feel like the tool itself.

- **Colors**: white background `#ffffff`, panels `#fafafa`, borders `#ececef`, text `#18181b`, secondary text `#52525b`, muted text `#a1a1aa`. One accent only: red `#ef4444`, used for the mark, pins, the logo dot and small highlights. Never for large areas.
- **Primary button**: dark `#18181b` with white text, fully rounded (pill), like the AAT tray.
- **Type**: Inter. Large, tight headline (around 56px desktop, 36px mobile, weight 600, slight negative letter spacing). Body 16 to 17px, line height about 1.6.
- **Layout**: centered column, max width around 1080px for visuals and 640px for text. Generous white space between sections (around 120px desktop, 72px mobile).
- **Signature detail**: a hand-drawn red pen stroke (SVG, 7px round line, 85% opacity) circling one word of the headline, such as "Point", animated drawing in once on load. Respect `prefers-reduced-motion` (show it static).
- **Numbered red pins** (24px red circles, white 2px border, white number) can mark the three steps in 4.3.
- **No** stock photos, gradients, glassmorphism, emoji, testimonials or fake stats.
- Dark mode: optional. If included, invert neutrals and keep the red.

## 6. Facts the copy may use (source of truth)

Only these are true. Anything else must not appear on the page.

1. Floating tray on the right edge of every page, visible to admins only.
2. Pin mode: hover outlines elements, click pins a note. The click does not trigger the page's own links or buttons.
3. Pen mode: a red stroke collects every element it crosses; a closed loop also collects the elements inside it.
4. Enter saves the note and copies the prompt to the clipboard; Shift+Enter adds a line; Esc steps back.
5. The prompt includes: page URL and title, viewport, and per element the tag and text, CSS selector, React component names (in development), attributes, classes, size and position, and current computed style. Pen notes also name the section that holds the marked elements.
6. A screenshot of the marked spot with the mark drawn in red. On localhost it is saved into the project and the prompt points at the file; otherwise it can be copied as an image.
7. Notes are saved in the browser (last 200), shown as numbered pins that follow their element.
8. A notes panel shows notes for this page or all pages, copies one prompt, copies all as one prompt, deletes and clears.
9. The tool's code is only loaded for admins; visitors never download it.
10. The tool never changes the page and never annotates its own UI. Errors inside it never break the page.
11. Built for Next.js App Router, React and Tailwind CSS v4. Uses modern-screenshot, lucide-react and sonner.
12. Distributed as a Claude Code skill, MIT licensed.

## 7. Technical requirements

- One static page (plain HTML/CSS/JS, or Next.js if you prefer). No tracking scripts, no cookie banner needed.
- Lighthouse 95+ on performance and accessibility. Real text, not text in images. Alt text on every visual. Visible keyboard focus.
- Meta: title "AAT, the Admin Annotation Tool", description "Point at your app. Get a prompt your coding agent can act on.", an Open Graph image (1200x630) showing the tray and a red pin on a white page.
- Placeholders to fill in: `{{GITHUB_URL}}`, `{{AUTHOR_URL}}`, the hero recording, the step clips.

## 8. Writing rules

- Plain, short sentences. Second person ("your app").
- No em dashes and no double dashes. Use commas or periods.
- No exaggeration ("revolutionary", "10x"). Let the prompt example do the selling.

## 9. Done when

- All sections in section 4 exist, in that order, with every claim traceable to section 6.
- The page reads well at 375px, 768px and 1440px wide.
- The only accent color on the page is `#ef4444`.
- Both GitHub buttons point to `{{GITHUB_URL}}`.
