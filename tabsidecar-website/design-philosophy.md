# TabSidecar Landing Page — Design & UX Decisions

Reference doc for `tabsidecar/index.html`. Captures the *why* behind the
design system, layout, and copy so future edits stay consistent.

---

## Product positioning

TabSidecar is a **tab + window manager** for Chrome, not just a tab cleaner.
Cleanup (Auto-Park) is one of several jobs — equal billing goes to the unified
tab list, window management, and session recovery.

- **Hero headline:** "Your tabs and windows, in one place." — deliberately names
  *both* tabs and windows so the page doesn't read as a OneTab clone.
- **Hero lead** names all four jobs in order: searchable tab list → save & name
  windows → restart recovery → cleanup. No em dashes (house style — see Voice).
- **"Replaces" chips** (OneTab, Toby, Session Buddy, The Great Suspender) anchor
  the category. Toby is intentionally included because it's the workspace-manager
  competitor, not just a cleanup tool.
- Status is **beta, built by one solo developer**. The page is honest about this
  rather than hiding it.

---

## Design system

### Color (CSS vars in `:root`)
Warm off-white paper, near-black warm ink, four accent hues used to color-code
the four feature areas. Avoid inventing new colors — use these.

| Token | Hex | Use |
|---|---|---|
| `--bg` | `#fbfbfa` | Page background (warm white) |
| `--ink` | `#2c2a26` | Primary text (warm near-black) |
| `--ink-2` | `#5f5b53` | Body / secondary text |
| `--ink-3` | `#8d887e` | Muted captions, metadata |
| `--line` / `--line-2` | `#e9e7e2` / `#f0eeea` | Borders, hairline dividers |
| `--accent` | `#3a63d6` (blue) | Primary actions, Smart Organizer |
| `--green` | `#2e9460` | Auto-Park |
| `--orange` | `#cf7a2c` | Session Recovery + the "Locked" pill |
| `--purple` | `#7a52cf` | Window Management |
| `--mark` | `#fbe6a4` | Highlight (currently unused — see note) |

**Each feature area owns one accent.** The eyebrow, bullet dots, and demo
accents all use that hue. Keep this mapping when editing.

### Type
- **Hanken Grotesk** (400/500/600/700) via Google Fonts. Grotesk, not a
  generic Inter/Roboto default.
- Fluid headings with `clamp()`; tight negative letter-spacing on h1/h2.
- Body 17px, line-height 1.6.

### Layout
- Single narrow column, `max-width: 880px`, centered. This is a focused
  marketing page, not a wide dashboard.
- Sections separated by hairline top borders + generous 80px vertical padding.
- Sticky blurred nav.
- Responsive: feature grids collapse to one column at ≤720px; secondary nav
  links hide on mobile.

---

## Page structure (in order)

1. **Hero** — tag, headline, lead, two CTAs, "Replaces" chips, static popup mock.
2. **Features** — four alternating (`.rev`) feature blocks, each with a small
   **animated demo** that plays when scrolled into view and settles to a static
   state under `prefers-reduced-motion`:
   1. **Session Recovery** (orange) — windows restore after a crash/restart.
   2. **Auto-Park** (green) — idle tabs close into a searchable list.
   3. **Window Management** (purple) — title / lock / save a window.
   4. **Smart Organizer** (blue) — rule-based tab routing into windows.
3. **The first week** — timeline of how it gets more useful over days.
4. **How it works** — 3 install steps.
5. **Building in the open** — honest beta note (currently commented out, see below).
6. **FAQ**.
7. **Pricing** — Free now / Pro later.
8. **Footer**.

---

## Feature-order & layout decisions

- Feature order was changed to put **Window Management third** and **Smart
  Organizer last**. Rationale: window management is a core differentiator and
  belongs with the other window features (Recovery, Auto-Park); Smart Organizer
  is the most advanced/optional, so it closes the section.
- The `.rev` class alternates the text/demo sides down the column. **When you
  reorder feature blocks, re-check the `.rev` classes** so the left/right
  alternation stays clean. Current pattern: orange (normal) → green (rev) →
  purple (normal) → blue (rev).

### Window Management — bullet decisions
- Capability list was trimmed from five bullets to **three** for focus:
  **Title**, **Lock**, **Save**. These map 1:1 to the demo's Title→Lock→Save
  animation chips, keeping copy and motion in sync.
- Cut: *"See every open window in a single list"* (table stakes — the demo
  already shows the list) and *"Anchor a window…"* (overlaps conceptually with
  Lock; demoted to the intro line rather than a headline bullet).
- **Anchor** still lives in the intro sentence ("title, lock, anchor, or save")
  and in the Pro plan, just not as an equal-weight bullet.
- **Lock** is framed against Auto-Park ("never auto-parked") — it's only
  meaningful *because* this product also has Auto-Park. That interdependence is
  the selling point.

### Session Recovery — bullet decision
- Third bullet was *"Mark one window as an anchor so it always returns,"* which
  collided with the new Anchor feature in Window Management. Replaced with
  **"Works even when Chrome's own restore doesn't"** — leans on the real
  competitive edge (Chrome's built-in session restore is unreliable).

---

## Animated demos

Each feature has a JS-driven demo (`data-demo="..."`) wired up in `init()`:
`recover`, `park`, `windows`, `sort`, plus the hero tab strip.

- Demos start on scroll-into-view (`onView`) and **loop**.
- All respect `prefers-reduced-motion`: when reduced, they render a final
  settled state instead of animating.
- **Window Management demo** cycles Title → Lock → Save: the active window's
  title types out to "Research", then Lock and Save chips highlight in sequence,
  dropping "Locked" (orange) and "Saved" (purple) pills onto the card, with a
  one-line hint explaining each step.
  - Note: the demo does **not** include an Anchor step (Anchor was demoted from
    the bullet list). If Anchor is ever promoted back to a headline feature, add
    a matching step here.

---

## Voice & copy guidelines

The reviewer's stated preference: **plain, grounded, un-corny.** Avoid
slogan-style or "AI-coded" lines (e.g. "No hype. Just a tool that respects your
tabs." was explicitly rejected).

- Honest about being beta and solo-built; never overclaim.
- **No em dashes** in headline/lead copy (house style).
- Don't name what's missing (an earlier line about "no testimonials yet" was cut
  — don't advertise the gap).
- Lead with the promise/guarantee, not the disclaimer.

---

## Pricing

- **Free** plan = everything available today, free during beta.
- **Pro** plan = "Coming soon" (disabled button, dashed border). Lists future AI
  features plus **"Advanced window management"** (kept deliberately short — longer
  phrasings like "grouping and rules" were rejected). The "Still working on it."
  note was removed.

---

## Navbar
- Links: Features · Pricing · **Privacy** · Add to Chrome (button).
- Privacy points to `#` — **placeholder, no page built yet.**

---

## Known placeholders / open items

- **Privacy** nav link → `#` (no page yet).
- **"Building in the open" section is commented out** in the HTML (the honest
  beta note + three trust cards). Left as an HTML comment with a restore note —
  uncomment to bring back. Reviewer felt it "didn't feel right" for now.
- `--mark` highlight token exists but the hero `<mark>` was removed; currently
  unused.
- Product mock in the hero is a **static placeholder** (`popup.png · tabs grouped
  by window`), not a real screenshot.

---

## Export notes
- Standalone/offline build: bundle to `TabSidecar.html` (fonts + assets inline).
  Requires the `<template id="__bundler_thumbnail">` already in `<head>`.
- Print/PDF: a separate `index.html` variant exists with print
  styles and demos forced to their settled static state.
