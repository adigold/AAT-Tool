# Contributing to AAT

Thanks for helping. AAT is small on purpose, so the bar for new features is "does this make the prompt better or the marking faster, without making the tool heavier".

## Ground rules

- **Read only.** AAT must never change the host page. No DOM writes outside its own portal.
- **Admins only.** Nothing may load or run for visitors. Keep the lazy import behind the gate.
- **Contained.** A failure inside AAT must never break the page. Screenshots and saving fail silently.
- **Private.** Notes stay in the browser. No network calls except the localhost screenshot route.
- **Same look.** Keep the design spec in `SKILL.md` (colors, sizes, copy). If you change the UI, update the spec in the same pull request.

## How the repo is laid out

- `SKILL.md` is the Claude Code skill: install steps, design spec and the verification checklist.
- `references/` is the source that gets copied into an app.
- `site/` is the landing page (plain HTML, CSS and a little JS).
- `demo-video/` is the HyperFrames source of the demo video.

## Making a change

1. Fork the repo and create a branch.
2. Make the change in `references/`. Keep the code style: small files, short comments that explain why.
3. Test it in a real Next.js App Router app with Tailwind CSS v4. Walk through the 15 point checklist in `SKILL.md`, including:
   - signed out: nothing renders and no extra request is made,
   - pin and pen on a page that scrolls,
   - the prompt text, and the screenshot on localhost,
   - a clean browser console.
4. If you changed the prompt format, update the example in `README.md` and `site/index.html`.
5. Open a pull request and fill in the template.

## Reporting bugs

Use the bug report form. Include your Next.js, React and Tailwind versions, the browser, and the prompt AAT produced (remove anything private).

## Security issues

Do not open a public issue. See [SECURITY.md](./SECURITY.md).

## Code of conduct

Be kind and specific. See [CODE_OF_CONDUCT.md](./CODE_OF_CONDUCT.md).
