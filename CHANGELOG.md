# Changelog

## Unreleased

The first version, not yet released.

- A catalogue of about 70 markers in ten panels, with English and Portuguese names and unit
  conversions. Every conversion factor is cited and tested.
- Each marker over time, every result against its own lab's range, in the unit you choose; a table of
  every marker by date.
- Three flags decided by code: outside the lab's range, changed since last time, and rising or falling.
- Reports entered by hand, as printed, with notes on the test (fasting, time, medications, recent
  illness or exercise).
- An encrypted vault in the browser, with a passphrase, auto-lock and encrypted backups. Several people
  per vault.
- Reading reports with AI (optional, your own Anthropic key): every row is checked by you next to the
  original page before it's saved.
- Cumulative lab reports: a report that also shows earlier results, in columns by date or as a
  history list, becomes one report per sample date, each row checked with its own date.
- Correcting a single result after it's saved: fix a misread value, add a missed result, delete one,
  or map an unknown name to a marker (remembered for next time, and optionally applied to earlier
  results printed the same way).
- AI summaries of a report or of everything, explaining only what the code flagged.
- A one-page report for your doctor, printed, saved as PDF or shared as an image.
- A demo with a made-up person, labs and sample report.
- Installable, and works offline.
- Accessibility: a "Skip to content" link; after each screen change, focus moves to its heading and
  the tab's title names it; checked with axe on every screen in both themes, at phone and desktop
  widths. Fixed the Table screen scrolling sideways on phones.
- A lighter landing page: app screens and the encrypted vault load when needed, and the font is
  preloaded (Lighthouse performance 95 → 97, first paint 2.1 s → 1.8 s on a simulated phone).
