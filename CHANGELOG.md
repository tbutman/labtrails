# Changelog

## Unreleased

Changes from an independent product review (October 7, 2026):

- Results the lab marked critical (HH, LL, critical, panic, !!), or at least one range width outside
  the range, are their own flag, with fixed text to check the result and contact a doctor or the lab
  today. The lab's printed mark is shown everywhere, including "N".
- Values under 1 keep three significant digits (0.003 no longer shows as 0).
- The doctor report dates every row and shows the previous result, the lab, the lab's marks,
  conversions and units, with a header (span, number of reports, prepared on, optional age and sex),
  a footer written for the doctor, and a hidden table for screen readers. Titled "Doctor report".
- "What 'outside the range' means", under a flag and in How flags work, citing MedlinePlus.
- Changes on a one-sided range are measured against its limit; the overview splits results outside
  the range from changes and trends inside it, and says "Back inside the lab's range".
- Known influences say "can", with each source's own limits, match more narrowly, and cite Lab Tests
  Online UK for 9 of the 17 pairs that cited Testing.com (the rest are named "Testing.com (formerly
  Lab Tests Online)"); two pairs added (statins and LDL, thyroid hormone and TSH), 42 in all; a script
  to recheck every quote by hand.
- Add results starts with no decimal mark; a value ten times beyond its range asks before saving; a
  personal line's unit is a menu.
- Units LabTrails can't convert are flagged against their own range and shown, not dropped; B12 in
  ng/L, glucose in g/L, prolactin in mIU/L and hemoglobin in mmol/L convert, each factor cited.
- A person can be deleted with everything kept about them; summary facts redact accented names.
- Files not read yet can be viewed and typed in by hand; PDFs open offline.
- Locking or reloading returns to the same screen after unlocking; a reloaded demo says it ended;
  forms warn before closing with typed values.
- Ask wraps on phones and shows the no-key notice on open; a root error screen; counts read
  "× 10⁹/L"; the table's date header stays in view; US English, with dates like "Sep 19, 2026".

## 0.1.0

The first version, live at [labtrails.app](https://labtrails.app) since October 6, 2026.

- A catalog of about 70 markers in ten panels, with English and Portuguese names and unit
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
- Before your next test (SPEC.md section 18, step 7): what was measured last time and what wasn't
  repeated, facts from your history (the times of earlier draws for markers that vary through the
  day, timed medications, fasting), and a request for the tests you tick, in English or Portuguese,
  to copy. The app never chooses the tests.
- Personal lines (SPEC.md section 18, step 6): a lower and/or upper value you or your doctor set for a
  marker ("My doctor's target: under 54"), drawn dashed on the chart in whatever unit it's shown,
  flagged as "Above your line", on the doctor report and in the AI's facts as the person's own line.
- Summaries and Ask use the context (SPEC.md section 18, step 5): with your consent, and listed on
  the send sheet, they get your timeline during the results, when each test was drawn relative to a
  dose, matched known influences, persistent flags and markers not repeated, and may state them as
  facts; never as a cause, and never as advice about a medication or dose.
- Known influences (SPEC.md section 18, step 4): each marker page lists documented things that can
  affect the test (40 marker–influence pairs, each cited to MedlinePlus, the NHS or testing.com with
  the quote checked against the page), and those the timeline or a test's notes include: "Your
  timeline includes Vitamin D3; vitamin D supplements are known to raise vitamin D." Never a cause.
- Dose timing per test (SPEC.md section 18, step 3): for timeline entries where the timing of a test
  matters, a test records whether the blood was drawn before or after that day's dose, or between
  doses with the last dose's date ("29 days after the last dose of …, every month"). Shown on the
  report, the marker page and the doctor report.
- The personal timeline (SPEC.md section 18, step 2): medications, supplements, lifestyle changes
  and events with start and end dates (or just months), doses and schedules; bands on every chart, a
  row in the table, an optional block on the doctor report, and "From your timeline" for a test's
  medications. Encrypted like everything else; not sent to the AI.
- A fourth flag: outside the lab's range on several tests in a row ("Above lab range · 4 tests").
  And "Not in your latest report": markers measured in the two years before it that it left out, on
  the overview, the doctor report and in the AI's facts. (SPEC.md section 18, steps 1.)
- The demo is in English: a fictional person with results from a US lab (mg/dL) and a UK lab
  (mmol/L and other SI units) on one chart, and an English sample report with a urinalysis row.
- Fictional test reports (a multi-page PDF with a previous-results column and a urinalysis page, and a
  two-photo US report) and a live extraction check against them. Text results such as "Negative" on
  a urinalysis are now recognized as already saved when a report is imported again.
- Reading real reports better (found by testing with four real Portuguese reports, October 2026):
  urinalysis rows are recognized as urine and never matched to blood markers (a "Sample" field in the
  review); ranges printed by age, sex or category use the right band (vitamin D's sufficient band, PSA
  for your age), or none rather than a wrong one; earlier-date columns use the report's printed range,
  marked as such; sample times, percentages written into values and cut-off count units are read;
  Portuguese report names (V.G.M., Creatininémia, TFGe and more) match without a manual check; free
  testosterone is in the catalog; a realistic cost estimate.
- Ask about your results: questions answered from the markers they name (or the flagged ones), with
  every number checked against what was sent before the answer is shown; saved conversations per
  person; prepared answers in the demo.
- Photos of one paper report can be grouped as its pages: read in one request, checked once, saved
  as one report, and shown page by page.
- Cumulative lab reports: a report that also shows earlier results, in columns by date or as a
  history list, becomes one report per sample date, each row checked with its own date.
- Correcting a single result after it's saved: fix a misread value, add a missed result, delete one,
  or map an unknown name to a marker (remembered for next time, and optionally applied to earlier
  results printed the same way).
- AI summaries of a report or of everything, explaining only what the code flagged.
- A one-page report for your doctor, printed, saved as PDF or shared as an image.
- Import several reports at once, or a zip of them, with duplicates caught: files already imported,
  a second copy of a saved report, and rows already saved. Files kept for later wait under "Not read
  yet". The AI also copies the lab name and fasting status for you to confirm.
- Edit a report's details (date, time, lab, notes) after saving.
- A landing page, and a redesign on the shared Trails design system (Inter, one component kit,
  contrast checked in both themes); the app itself is at /app.
- A demo with a made-up person, labs and sample report.
- Installable and works offline, with a Reload banner when a new version is ready.
- Accessibility: a "Skip to content" link; after each screen change, focus moves to its heading and
  the tab's title names it; checked with axe on every screen in both themes, at phone and desktop
  widths. Fixed the Table screen scrolling sideways on phones.
- A lighter landing page: app screens and the encrypted vault load when needed, and the font is
  preloaded (Lighthouse performance 95 → 97, first paint 2.1 s → 1.8 s on a simulated phone).
