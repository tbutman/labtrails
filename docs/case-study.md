# LabTrails: blood test results over time, private by design

*Case study, October 2026. LabTrails is live at [labtrails.app](https://labtrails.app) and in active
development. Screenshots show the demo; every name and value in them is made up.*

<p>
  <img src="screenshots/landing.png" width="720" alt="The LabTrails landing page: every blood test, one clear timeline">
</p>

## The problem

My blood test results lived in a long ChatGPT thread: years of reports from labs in Portugal and the
US, in two languages and two sets of units. Comparing one marker across years meant scrolling and
converting in my head. Most trackers want an account and a copy of your results on their servers,
which is a lot to ask for health data, and many lean on AI to tell you what your results "mean".

I wanted something narrower and more trustworthy: every result in one place, each marker on a chart
over time, clear flags for what's outside the lab's range or has changed, and help preparing for a
conversation with my doctor. Not a diagnosis.

## The decisions that shaped it

**Local-first, bring your own key.** The app is static files. Results are encrypted in the browser
(AES-256-GCM, with the key derived from a passphrase using Argon2id) and never reach my server: no
accounts, no database, no analytics. AI is optional; the browser calls Anthropic directly with the
user's own API key, after a screen that shows exactly what will be sent. The cost of this choice is
real (no password reset, no sync between devices), so the app says so plainly and pushes encrypted
backups.

**The code flags; the AI explains; the user confirms.** This split runs through the whole app:
- **Flags are code.** "Outside the lab's range", "changed since last time" and "rising or falling"
  are pure, tested functions, labelled in the app as heuristics, not clinical thresholds.
- **The AI copies; the code decides.** Reading a report, the AI only copies rows as printed into a
  JSON schema whose marker field is limited to catalogue IDs. LabTrails' own matching maps names
  first; the AI's suggestion is a fallback, marked "Unsure".
- **The user confirms every row** next to the original page before anything is saved, so text in a
  document that tries to steer the AI goes nowhere unless the user ticks it.
- **Summaries are grounded** in a facts object the code builds, with the person's name and date of
  birth removed, and prompts that forbid diagnosing, adding flags or suggesting treatment.

**Each result against its own range.** Labs print different reference ranges, so a single "normal"
band would be wrong. Each chart point sits on its own lab's range, and flags compare each result with
that range.

<p>
  <img src="screenshots/dashboard.png" width="720" alt="The dashboard: the markers worth discussing, each with its value, flags and a small trend">
</p>

**Store what was printed; convert when showing.** Values, units and ranges are kept exactly as printed,
and converted only for display and flags, so a wrong factor could be fixed without touching anyone's
data. Every conversion factor is derived from a molar mass, cross-checked against the AMA's SI table,
cited in the code and tested against an independently computed value. That check caught one wrong
factor (creatinine) before release. A few details mattered more than expected:
- Insulin uses 6.00 pmol/L per µIU/mL; the often-quoted 6.945 comes from a superseded 1959 standard.
- Portuguese "ureia" (urea) and US "BUN" (urea nitrogen) are different measurements, about 2.14×
  apart, so they're separate markers and BUN appears on the urea chart converted and labelled.
- Lp(a) refuses to convert between mg/dL and nmol/L, following the European Atherosclerosis Society's
  advice that no single factor is valid.
- Reports from two countries mean decimal commas and points, "<0,5" and "inferior a", and dates like
  03/04 that could be March or April, which the user confirms.

## Importing years of reports

The first version read one report at a time. Importing a history needed more, so the import became a
queue:

- **Several files or zips at once.** Zips are opened in the browser, with caps on file count and
  unpacked size so a crafted zip can't exhaust memory.
- **Duplicates caught at three levels.** The same file is recognised by its SHA-256 fingerprint before
  anything is sent to the AI (saving the cost of reading it again). The same report from a different
  file, such as a PDF and a photo of it, is recognised by its values, with a "Skip this one" link. And
  rows already saved are left out of the review, so nothing is doubled on the charts.
- **One agreement for the batch,** then each report is stored, read and checked in turn. Anything not
  read yet stays listed, so leaving mid-way loses nothing.

<p>
  <img src="screenshots/import-queue.png" width="560" alt="The import queue, with a repeated file set aside as already imported">
  <img src="screenshots/review.png" width="560" alt="Checking rows read from a made-up report, with the report beside them">
</p>

## Two apps, one core, two agents

LabTrails was built alongside a sister app, [BabyTrails](https://babytrails.app) (baby growth on WHO
charts), by two AI coding agents working in parallel, which I directed and reviewed. They share a core:
the encrypted vault, storage, backup, documents, the review screen, the AI client, a design system and
now the import flow. Ownership was explicit: BabyTrails owned the core, and LabTrails wrote some shared
pieces first (the design system and the import), which then moved into the core. The agents
coordinated through a shared notes file of proposals, requests and a log, with me deciding anything
that affected both apps.

**A design system, not a theme.** After the first versions worked, both apps were rebuilt on one kit:
Inter throughout with tabular figures, a shared palette with one accent per app, and components from
form fields to metric cards and landing-page sections. Each app has its own landing page from the same
template. Colour contrast is checked against WCAG 2.1 by a unit test in both apps; it caught a teal
that was 4.3:1 on one surface, below the 4.5:1 minimum.

## Shipping and what broke

The apps are served as static files from my home server through a Cloudflare Tunnel, deployed by
pulling checksummed GitHub releases, so no workflow holds server credentials. Going live surfaced real
problems, each now guarded by a test:

- The PDF viewer's worker was served with the wrong type (nginx has no entry for `.mjs`), so PDFs
  wouldn't open. CI now serves every build through the server's own nginx config and checks every
  file's type.
- Returning visitors kept seeing the old version after a deploy, because the new offline worker
  waited for every tab to close. Both apps now show a Reload banner instead, since switching by itself
  would lock the vault and drop anything being typed.
- A shared encryption test failed now and then. It turned out to be a false positive: random encrypted
  bytes, written as base64, occasionally contain the four letters it checked for.

## What was tested

- **291 unit tests**, including every unit conversion both ways, English and Portuguese marker names,
  the flag rules with ranges from different labs, the extraction validator, summary facts never
  containing the name or date of birth, zips and zip bombs, duplicate detection, colour contrast, and
  the shared core's encryption, backup and review rules.
- **8 browser tests** against the production build, every one failing if the app contacts any site
  other than itself: a full vault round trip that leaves nothing readable in the browser's database,
  the demo, installing and reloading offline, a whole import with all three duplicate levels, and,
  with a mocked AI, that nothing is sent before the user agrees, the person's name never appears in a
  request, only ticked rows are saved, and AI text with HTML in it is shown as text.
- **CI** runs lint, typecheck, the tests, the build and the nginx check on every push.

## What's next

- Testing with my own reports, from both countries.
- Grouping several photos as the pages of one report, and lab-history PDFs with several dates.
- Correcting a single saved value, and per-marker change thresholds based on published biological
  variation instead of one percentage for every marker.
- Later: questions about your history, more AI providers, encrypted sync, and a Portuguese interface.
