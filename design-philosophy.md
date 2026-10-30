# tabsidecar.com: design and UX decisions

Reference for the pages in this repo. Captures the *why* behind the design,
layout and copy so future edits stay consistent. Last rewritten September 27,
2026, when the site moved to the Windows design; home page sections reworked
October 13, 2026; Chrome only, Session restore picture and whole window titles
October 30, 2026 (TabSentry #504); AI window titles section the same day
(TabSentry #505).

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

`assets/common-passwords.txt` isn't a prototype file either: the build copies
the extension's own `background/common-passwords.txt`, so the site and the
extension refuse the same passwords. Never edit the live pages here directly;
a fix made only here is undone by the next build (that happened to the #178
fixes until October 13, 2026).

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
  popup blue `#3b82f6`, Auto-Park amber `#f59e0b`, AI window titles violet
  `#8b5cf6`, Saved Windows sky `#0ea5e9`, Cloud Sync pink `#ec4899`. The FAQ
  is neutral, like the All tabs group. Each section has its own color; the
  list bar shows them in page order.
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

1. **Hero:** "Free for Chrome" pill, *Close tabs without losing them.*, one
   lead sentence, Add to Chrome (on a phone, View in Chrome Web Store: see
   Phones below). The site names Chrome only: the launch and
   the testing are Chrome only for now (Mario, October 30, 2026), so no other
   browser is named anywhere on it, the closing's "Free · Chrome" included
   (`website-check.mjs` checks every page, TabSentry #504).
2. **TabSidecar** (blue, "Current"): the clickable popup mockup. Where the
   full popup would be scaled so far that its text can't be read (a box under
   about 650px: phones and tablets), a phone-sized popup takes its place: the
   Tabs page alone at its real size, filling the section, with Launch week
   open and Reading list and Home folded (TabSentry #506).
3. **Auto-Park** (amber): the headline feature. Text on the left with a short
   "never park" list (pinned, locked, playing sound) and Replay; on the right
   the animated demo, the window stacked above AutoParked.
4. **Session restore** (teal, "Anchored"): three numbered points (named
   windows first, the rest folds away, the Last session page), then one line
   on anchoring (the anchored window comes back on its own each time Chrome
   starts). On the right, the anchored window **Daily** as a teal window card
   with the Anchored tag and two of its tabs, a one-line caption ("Daily is
   anchored, so it came back on its own."), then the restore banner as the
   popup draws it after the restore redesign (TabSentry #267-#275): the
   summary with "Chrome started …", Show restored windows, Restore all,
   **Named windows**, then **Other windows (N)**, folded. No popup frame
   around them. Restore, Hide (with the popup's toast and Undo) and Restore
   all work, with the popup's words. The copy never points at the page's
   colors ("this teal"): the teal means something because the picture shows
   the anchored window in it (TabSentry #504). The banner stays amber, as in
   the popup, where amber means "needs you".
5. **AI window titles** (violet, "off until you turn them on"): *Windows that
   name themselves.* One sentence on what it does (names each window from its
   tabs, with the setup card's examples, and updates the name as tabs come
   and go), three short points (your names stay unless you ask; Generate AI
   Title for one window; the name stays after a restart), then one muted line: off until
   you turn it on, what a request sends (tab titles and site names, not page
   contents or full addresses, to our AI server, which asks Google Gemini)
   and a link to the privacy policy's AI section for the full list. The copy
   must read as opt-in everywhere and agree with the privacy policy. On the
   right, a before/after: a new window as the popup names it before it has a
   title ("Window 1042", six tabs, the AI tag), a caption, then the same
   window folded with its AI title, **Laptop research** (the restore banner
   lists the same window). The Questions add "What do AI window titles
   send?". TabSentry #505.
6. **Saved Windows** (sky): got its own section instead of a tile. A strong
   reason to install on its own. Six saved windows, each with its title,
   meta, favicons and Open.
7. **Cloud Sync** (pink): text on the left (snapshot every hour, import on a
   new machine or profile, about a week of snapshots per device, off unless you
   sign in); on the right the Cloud Sync page's This device card and Latest
   snapshots, four rows from three devices.
8. **Questions** (neutral FAQ), then a closing call to action.

The nav, the list bar ("N windows" and its swatches) and every ⋮ jump menu
follow the sections: a new section goes in all three, and the nav lists every
feature section (the ones with a jump menu). `website-check.mjs` checks it on
every page (TabSentry #505).

Removed on purpose:
- A Search section (the hero promises search and the popup mockup shows it)
  and a "Make it yours" theme picker (on phones the options pushed the popup
  out of view).
- **Organize** and **And the rest** (October 13, 2026): grids of icon tiles
  with a heading and a line of copy looked weak next to the product pictures,
  and a richer version with a picture per tile made the page long. The page
  now keeps to the five features that sell it; the rest is in the popup
  mockup. The "What comes along" checklist in Cloud Sync went for the same
  reason.

### Layout rules
- **Text left, picture right** in every feature section, both columns
  centered vertically. Keep the picture about as tall as the text: trim rows
  (four snapshots, Other windows folded) rather than leave a short column next
  to empty space.
- **Pictures are the product.** Draw them from the popup's own markup and
  words (`assets/mock.js`): the restore banner, the Cloud Sync page, window
  cards. Check the extension before showing a control: window colors are
  assigned automatically (there is no color picker), and Save for later puts
  a tab on a list with a "Later" chip (there is no timed snooze).
- **Phones:** check 375px and 320px, as a phone (with touch). Columns stack,
  text first. Mock rows drop secondary text before anything overflows (banner
  rows put their buttons on a second line, and so does the banner's Dismiss
  when the summary leaves no room); the top nav hides below 900px; nothing
  may scroll sideways. TabSentry #506 added these, each checked by
  `website-check.mjs` on every page at every width:
  - **Text in a picture is 9px or more** as drawn, scaling included: a
    picture that would shrink below that draws a smaller version instead
    (the phone-sized popup). Favicon letters are the one exception: they
    stand for a site's icon.
  - **No control is cut.** No button, tag or link in a picture or a section
    header runs past an edge that hides it. A section header whose tag
    doesn't fit beside its title and ⋮ puts the tag under the title (never
    drops it). The desktop popup's tab list is the exception: it is cut at
    the popup's height, as in the extension, where it scrolls.
  - **A phone isn't asked to install.** A phone or tablet can't add a Chrome
    extension, so on a touch screen with no mouse under 1024px the store
    buttons say "View in store" / "View in Chrome Web Store", the hero adds
    "It runs in Chrome on your computer." and the closing says to add it on
    the computer. On a computer every store button says "Add to Chrome".
    The phone is told apart by the screen (width, `hover: none`,
    `pointer: coarse`), never by the user agent.
- **Window titles are never cut** in a picture outside the popup mockup
  (TabSentry #504). A window card that runs short of room drops its meta
  first, then its plain tags (Saved, locks; never Current or Anchored), then
  its favicons one at a time (the "+N" counts the rest), then the whole strip.
  On narrow cards (under 460px) the plain tags are hidden anyway, except
  Current, Anchored and AI, which say what a picture is about.
  It measures the card itself, not the page width, so it holds at every width
  and wherever the card sits (`fitWindowHead` in `assets/mock.js`).
  `website-check.mjs` checks every title at every width.

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
Both pages drop the token from the address bar on load, refuse a common
password (the extension's list, `assets/common-passwords.js`; if the list
can't load, the password is allowed), and after a password is set sign out
every session, the link's own included, so the link can't set another password
without the current one (#178).

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
- Name Chrome only (see Home page, item 1).
- Copy describes the product, not the page: no "this teal" or "the card
  below".

---

## Open items

- The FAQ says TabSidecar is free and that an account is only needed for Cloud
  Sync. Revisit if Cloud Sync ever becomes paid or limited.
- The wordmark uses the "TS" tile, not `icons/icon128.png`.
