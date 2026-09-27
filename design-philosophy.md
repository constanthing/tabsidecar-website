# tabsidecar.com: design and UX decisions

Reference for the pages in this repo. Captures the *why* behind the design,
layout and copy so future edits stay consistent. Last rewritten September 27,
2026, when the site moved to the Windows design.

---

## Where the pages come from

Don't edit the HTML here by hand. The pages are built from prototypes in the
extension repo:

| Live file | Prototype (TabSentry/website/prototypes/) |
|---|---|
| `index.html` | `home-windows.html` |
| `privacy.html` | `privacy.html` |
| `reset-password.html` | `reset-password.html` |
| `email-confirmed.html` | `email-confirmed.html` |
| `assets/*` | `shared/*` |

Edit the prototype, preview it with `python website/serve.py` (no-cache server
on port 8765), then from the TabSentry repo run

    python website/build_site.py ../tabsidecar-website

and commit and push here. The build strips everything between proto markers
(`<!-- proto -->…<!-- /proto -->`, `/* proto */…/* /proto */`): the prototype
switcher bar, review notes, state previews and fake-success shortcuts. It
stamps asset URLs with a build version and fails if anything prototype-only is
left. Never write the literal marker text inside a comment; the build will
strip from there.

`icons/` stays here and isn't built: the favicons and the account emails load
`icons/icon48.png` from the live site.

---

## The idea: the page is a window list

The site looks like the product. Every section of the home page is a **window
card**, drawn the way the popup draws a window with the Tint style: a 4% wash
of the window color, a tinted border, a 4px color stripe on the left, and a
header with a caret, color dot, title and meta. Sections collapse like windows,
and each ⋮ menu jumps to any other section. Product pictures are live HTML
mockups built from the popup's own styles (`assets/mock.css`), not
screenshots, so they stay sharp and the big one is clickable.

### Color
One white background, no color bands. Color only appears where it means
something:

- **Window colors** name the sections, like window colors in the popup:
  popup blue `#3b82f6`, Auto-Park amber `#f59e0b`, Saved Windows sky
  `#0ea5e9`, Cloud Sync pink `#ec4899`, Organize violet `#8b5cf6`, And the rest
  indigo `#6366f1`. The FAQ is neutral, like the All tabs group.
- **Anchor teal** `#009688` belongs to recovery and anchored windows only
  (Session restore). Don't use it for anything else.
- **One blue button** per view for the main action (`--brand #3b82f6`).
- Status banners use the popup's banner colors: green done, amber needs you,
  red failed.

The tokens are the popup's, in `assets/mock.css` (`--text #17181c`,
`--muted #70737c`, `--border #e6e7eb`, `--app #f6f7f9` and so on). Don't add
new colors.

### Type
System fonts, the same as the extension: Segoe UI Variable (Display for
headings) with the usual `-apple-system`/Roboto fallbacks. No web fonts.

### Controls are popup-sized
Buttons, fields and menus match the popup's density, not typical marketing
sizes. On account pages: 32px buttons (7px corners, 13.5px text), 38px
password fields, 30px menu items. "Fat" 42px+ buttons go against the design.
The one exception is the hero and closing "Add to Chrome" calls to action.

---

## Home page (`index.html`)

Order, top to bottom:

1. **Hero:** "Free for Chrome and Edge" pill, *Close tabs without losing
   them.*, one lead sentence, Add to Chrome.
2. **TabSidecar** (blue, "Current"): the clickable popup mockup.
3. **Auto-Park** (amber): the headline feature, with its animated demo.
4. **Session restore** (teal, "Anchored").
5. **Saved Windows** (sky): got its own section instead of a tile. A strong
   reason to install on its own.
6. **Cloud Sync** (pink): sign in, snapshot every hour, sign in on a new
   machine or profile and import. Its checklist lists only what a snapshot
   really contains (closed windows yes, single closed tabs no).
7. **Organize** (violet): *Five ways to keep your windows tidy.* Name and
   color windows, anchor, rules, labels, nicknames and notes.
8. **And the rest** (indigo): eight small-feature tiles.
9. **Questions** (neutral FAQ), then a closing call to action.

Removed on purpose: a Search section (folded into a tile; the hero already
promises search) and a "Make it yours" theme picker (on phones the options
pushed the popup out of view, so you couldn't see what they changed; it's a
tile now).

### Layout rules
- **Two columns only when both sides are about the same height** (Session
  restore, Saved Windows). When one side is much taller, **stack**: heading and
  intro on top (max 640px wide), content full width below (Auto-Park,
  Organize, Cloud Sync). Don't leave a short column next to empty space.
- **Tiles** (Organize, And the rest): icon in a small box on top, bold title,
  one line of copy. Equal columns (3 or 4 wide, 2 on tablets, 1 on phones). A
  short last row stays left-aligned; never stretch items to fill it. Pick
  counts that fill rows (And the rest is 8 in 4 columns).
- **Examples are tiny.** Organize shows small inline chips (window names,
  label pills, `github.com → Work`) instead of full menus or popup
  screenshots, which ate phone screens.
- **Phones:** check 375px and 320px. Mock rows drop secondary text before
  anything overflows; the top nav hides below 900px; nothing may scroll
  sideways.

---

## Legal page (`privacy.html`)

Read as a document, not a window list:

- **At a glance** is the only window (blue): five summary rows that only
  restate the policy.
- A numbered **In this policy** contents list, then plain sections with
  headings and flowing text.
- **Never collapse sections.** Collapsed text is hidden from find-in-page, so
  someone searching for "delete" could find nothing, and a privacy policy must
  never look like it hides something.
- Facts go in simple panels (permission rows, "Sent to / What's sent" style
  lists), not nested cards.
- The policy text is the source of truth; change wording deliberately, and
  keep it in step with the extension's code and the Supabase setup.

---

## Account pages (`reset-password.html`, `email-confirmed.html`)

Where the Cloud Sync emails land. One blue window card titled "TabSidecar
account · Cloud Sync", so a page opened from an email link clearly belongs to
TabSidecar. Popup-sized controls, requirements checked off as you type
(8-character minimum, matching `MIN_PASSWORD_LENGTH` in the extension), and a
state for every outcome: ready, working, failed, done, expired link, no link.
Both pages drop the token from the address bar on load and sign out the
account's other sessions after a password is set.

## Account emails

Same look as the account pages: white page, one window card with the blue
stripe, a popup-sized button, the code in a mono box. Tables and inline styles
only, so Gmail and Outlook render them alike. Built by
`TabSentry/supabase/email-templates/build.mjs`; paste each file into Supabase →
Authentication → Emails. The dashboard copy is what gets sent. Sent today:
Confirm sign up, Magic link (existing account) and Reset password. Change email
address is archived and Reauthentication is unused, but both stay branded.

---

## Voice and copy

Plain, grounded, un-corny. Avoid slogan-style or "AI-coded" lines.

- Honest; never overclaim. Every claim must match what the extension does
  (check the code when unsure).
- **No em dashes** in page copy.
- Don't name what's missing.
- Lead with the promise, not the disclaimer.
- Short headings that say what happens: *Chrome restarts. Your windows come
  back.* *New laptop. Same windows.*

---

## Open items

- The FAQ says TabSidecar is free and that an account is only needed for Cloud
  Sync. Revisit if Cloud Sync ever becomes paid or limited.
- The wordmark uses the "TS" tile, not `icons/icon128.png`.
