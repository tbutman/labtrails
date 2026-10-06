# Trails UI v2

The design system for the Trails apps, [BabyTrails](https://babytrails.app) and
[LabTrails](https://labtrails.app). Written in LabTrails first (as `src/trails-ui/`), then moved into
the shared core (`src/core/ui/`), which BabyTrails owns; both apps use it from there. Changes are
logged in the Trails coordination notes so LabTrails can re-sync.

## What's here

| File | What it holds |
| --- | --- |
| `tokens.css` | Type (Inter, self-hosted, OFL), spacing, radii, shadows, the "Honey and ink" neutrals in light and dark mode, chart colours, and the per-app colour slots. |
| `components.css` | Base styles and every component: app bar and phone tab bar, page header, buttons, form fields, segmented controls, toggle chips, switches, file drop zone, cards, callouts, lists, chips, metric cards and sparklines, stats, empty states, skeletons, tables, disclosures, landing-page sections, auth screens. It also styles the core's existing components (ReviewPanel, SendSheet, AiOutput, DocumentViewer, ApiKeySettings) by their class names. |
| `components.tsx` | React wrappers: `TrailMark`, `Wordmark`, `AppIcon`, `AppBar`, `PageHeader`, `Callout`, `EmptyState`, `Field`, `TextField`, `SelectField`, `TextAreaField`, `Segmented`, `ChipGroup`, `Switch`, `Checkbox`, `FileDrop`, `Chip`, `Sparkline`, `MetricCard`. |
| `landing.tsx` | Landing-page sections: `LandingNav`, `Hero`, `Section`, `FeatureGrid`, `Steps`, `Showcase`, `PrivacyPanel`, `Faq`, `CtaBand`, `SiteFooter` (with the sister-app link). |
| `UpdatePrompt.tsx` | The "a new version is ready, Reload" banner (see the core README). |

**Added in the core** (6 October 2026, after the move), at the end of `components.css`: the auth
helpers (`.auth-links`, `.form-error`, `.form-footnote`), `.disclaimer`, loading shapes
(`.loading-title`, `.loading-card`), `.avatar`, the landing preview (`.preview`, `.preview-main`,
`.preview-head`, `.preview-float`) and `.showcases` (moved from LabTrails' `app.css`, so both landing
pages share them), `.chip.strong` (a chip that stands out without colour, used for low-confidence
review rows), `.ai-text` and `.update-banner`. The tokens' header comment now says 4 px steps, as the
values are.

Dependencies: `@fontsource-variable/inter` and `lucide-react` (ISC; icons are passed in as
components, so each app bundles only the icons it uses), plus `react-router` for links.

## Using it

```ts
import './core/ui/tokens.css'
import './core/ui/components.css'
import './app/accent.css' // the app's colours, below
import './app/app.css' // anything only this app needs
```

Each app sets its colours for both modes, and nothing else (BabyTrails' honey is in
`src/app/accent.css`, with its contrast ratios; `tests/unit/contrast.test.ts` checks the rules below
against the CSS files):

```css
:root {
  --accent-light: #0f7a6a;      /* fills, chart points, accent buttons */
  --accent-text-light: #0f7a6a; /* accent text and lines, ≥ 4.5:1 on the background */
  --accent-soft-light: #e1f2ed; /* tints: selected chips, range bars, icon tiles */
  --on-accent-light: #ffffff;   /* text on an accent fill */
  --accent-dark: #5acdb6;       /* also the dark-mode primary button */
  --accent-text-dark: #7fd8c5;
  --accent-soft-dark: #17393a;
  --on-accent-dark: #0e1124;
  /* optional, for flags: --flag-light, --flag-soft-light, --flag-dark, --flag-soft-dark */
}
```

A `Brand` object gives the wordmark, home link, repository and sister app:

```ts
export const BRAND: Brand = {
  name: 'LabTrails', prefix: 'lab', home: '/',
  sister: { name: 'BabyTrails', prefix: 'baby', url: 'https://babytrails.app', tagline: 'baby growth on WHO charts' },
  repo: 'https://github.com/tbutman/labtrails',
}
```

## Rules

- **One typeface:** Inter for everything, wordmark included. Numbers use tabular figures (`.num`,
  tables, metric values) so they line up.
- **Colour is never the only signal.** Flags carry an icon and words; the accent marks actions and
  data, not meaning.
- **Contrast** (WCAG 2.1): text and muted text ≥ 4.5:1 on every surface in both modes; control
  borders 3.4:1 (light) and 3.3:1 (dark), because WCAG 1.4.11 asks 3:1 for the edge that identifies a
  control. Card and divider borders are lighter, because they're decorative.
- **Spacing** on a 4 px scale (`--space-1` … `--space-9`); radii 8, 10, 14 and 20 px; soft layered
  shadows (`--shadow-xs` … `--shadow-lg`) instead of heavy borders.
- **Form fields** are 44 px tall with 16 px text (stops iOS zooming), a 3 px focus ring in the accent,
  and labels, hints and errors wired up by `Field`.
- **Motion** is short (160 ms) and off under "reduce motion".
- **Inside the app:** the `AppBar` shows sections on wide screens and becomes a bottom tab bar on
  phones; `PageHeader` gives every screen the same title, subtitle, actions and back link.
- **Landing pages** share one structure: nav, hero with a live product preview, features, how it
  works, showcases, privacy, FAQ, call to action, footer linking the sister app.
