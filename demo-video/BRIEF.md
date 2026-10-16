---
workflow: general-video
flow: automation
storyboard: no
message: "Point at your app. Get a prompt your coding agent can act on."
destination: website-embed
aspect: 1920x1080
language: en
length: 24s
angle: product-demo
---

## Intent

A silent product demo of AAT (Admin Annotation Tool) for the GitHub README and the landing page.
Adi: "a nice demo GIF or video without any music and without anything that will be looped, so the user can understand what this tool does."
Bright, minimal, not AI-slop. Shows the real AAT UI (dark tray, red pin, white comment card, toast) on a sample pricing page.

## Notes

- No audio at all. Plays once and holds on the end card; nothing loops (GIF exported with loop count 1).
- UI must match the real AAT design in references/components/aat/aat.tsx (colors, copy, layout). Prompt text matches buildPrompt() output.
- Accent red #ef4444 only for marks. The sample app has its own brand blue.
