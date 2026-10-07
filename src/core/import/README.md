# Trails import

The shared import flow for the Trails apps: several files or zips at once, duplicates caught at three
levels, one agreement for a batch, documents read one after another, and a review queue. Written in
LabTrails first (`src/trails-import/`); it now lives in the shared core (owned by BabyTrails) as
`src/core/import/`, next to `documents/`, `review/` and `ai/`, and each app plugs in through an
`ImportAdapter`. It contains no app-specific code. Changes are logged in the Trails coordination notes
so LabTrails can re-sync.

**Pages of one document** (coordination request 17, October 6, 2026). Optional and backward
compatible: an adapter without `readPages` sees no change.
- **Queue:** `group` (ready photos, in the order given, become one unit with `pages: IntakeFile[]`;
  PDFs, files kept without reading and duplicates can't be pages), `ungroup` (each page becomes its
  own unit again, with its file's id), `move-page`, and `stored-pages`. `canBePage(unit)`,
  `unitPages(unit)`. In the queue, "Pages of one {noun}?" lets the user tick photos in page order,
  then reorder or separate them.
- **Storage:** each page is its own `DocumentRecord` (one blob each, its own fingerprint), linked by
  the new optional `group: { id, page }` (`src/core/documents/documents.ts`, with `pagesOf(doc, all)`).
  `unitsFromDocuments` brings a stored group back as one unit, in page order, so "Not read yet" works.
- **Reading:** `adapter.readPages(pages: { doc, bytes }[])` is called with every page together; each
  row's `page` is its page number. The send sheet counts each page as a photo.
- **Review and viewing:** `DocumentPages` (`src/core/documents/DocumentPages.tsx`) shows one page at a
  time with a pager, or every page in order. A saved record points at the first page's document; all
  pages are marked read. Apps list a group once (`group.page === 1`) and show all its pages.
- **Fixed:** `ReviewPanel`'s `source` now receives `(page, onPageChange)`, so a viewer's previous/next
  buttons and the rows' "Show page" move the same page. Before, a multi-page PDF's buttons didn't move
  the review's page.

**Changed in the core** (October 6, 2026, after the move from LabTrails' `3755a1b`):
- **Document kinds per file.** An adapter can pass `kinds` (each `{ value, label, read }`) and
  `kindFor(file)`. The queue then shows a type picker on each file; kinds with `read: false` are kept
  without reading, and documents are stored with the chosen kind. BabyTrails uses it for growth
  reports and booklet pages (read), and doctor's notes, ultrasound images and other files (kept).
  Without `kinds`, nothing changes: every file is stored as `documentKind`. The queue has a new
  `kind` action, allowed while a file is ready or set aside as a duplicate.
- Documents are dated with the local date, not UTC (which could be a day off).
- "Checking against your saved results…" now reads "Checking against what's already saved…".
- Imports use relative paths inside the core (`../review/model`, `../store/types`, …).

## The flow

1. **Add files:** PDFs, photos or zip files, several at once (drop or pick). Zips are opened in the
   browser with `fflate`. Each file is checked by its real type and given a SHA-256 fingerprint.
2. **The queue:** one row per document to create, with its status. Files the vault already holds, or
   that appear twice in this import, are set aside as **Already imported** (the user can import them
   anyway). Any file can be removed or marked **Keep without reading**.
3. **Agree once:** the core's `SendSheet` for the whole batch (counts, total size, cost estimate). The
   demo skips it, since nothing is sent.
4. **Store, then read:** every file is stored encrypted as a document first, then read one after
   another. A failure marks that file and the rest carry on; failed files can be retried.
5. **Check each one:** when a document comes up for review, the adapter compares what was read with
   what's saved: rows already saved are left out (and listed), and a document that repeats an existing
   record is pointed out with a "Skip this one" link. The core's `ReviewPanel` does the rest, so only
   rows the user ticks are saved.
6. **Summary:** what was saved, kept, skipped, failed or left out as a duplicate.

Documents carry `meta.sha256` and `meta.importStatus` (`unread`, `read` or `stored`). Apps list
`unread` documents as "Not read yet" and can start the wizard with them (`initialDocuments`).

## Files

| File | What it does |
| --- | --- |
| `intake.ts` | `intake(files, limits?)`: type checks, zips, fingerprints, repeats within a drop. Limits on files per batch (60), file size (25 MB, the AI request limit), zip size (200 MB) and total unpacked size (400 MB); nested zips, folders, macOS metadata and hidden files are skipped. |
| `duplicates.ts` | `storedFingerprints(store)`: every stored document by fingerprint; older documents without one are fingerprinted once and updated. `ImportMeta`, `StoredDoc`. |
| `queue.ts` | The queue as a pure reducer: statuses, the allowed moves between them (nothing reaches "saved" without "review"), counts. |
| `adapter.ts` | The `ImportAdapter` interface an app implements. |
| `ImportWizard.tsx` | The screens. Takes `adapter`, `store`, `profileId`, `model`, optional `initialDocuments`, `demo`, `onFinish` and a `header(title)` render function, so each app keeps its own page chrome. |
| `import.css` | A few styles on top of the Trails UI kit. |

## Writing an adapter

```ts
const adapter: ImportAdapter<MyMeta> = {
  appName: 'BabyTrails',
  documentKind: 'growth-report',
  noun: { one: 'document', many: 'documents' },
  columns,                        // the ReviewPanel columns
  canRead: demo || !!apiKey,
  read: async (doc, bytes) => ({ rows, meta, dropped }),   // throw new Error(message) to mark it failed
  check: async ({ rows, meta }) => ({ alreadySaved, similar }), // optional; queries the store at review time
  save: async (doc, confirmedRows, meta) => '3 measurements saved',
  MetaEditor,                     // optional: edits `meta` above the rows (a lab name, a visit)
  sendSheet: { notSending: [...], notes: [...] },
  estimate: ({ pdfs, images }) => ({ inputTokens, outputTokens }),
  storeOnlyByDefault: (file) => false, // BabyTrails: ultrasound images are kept, never read
  kinds: [{ value: 'report', label: 'Report', read: true }, { value: 'note', label: 'Note', read: false }], // optional
  kindFor: (file) => 'report',     // optional: the kind a file starts as
  sample: { url: '/demo/sample.pdf', title: 'Sample (fictional).pdf' }, // for the demo
}
```

BabyTrails' adapter is `src/app/import/babyAdapter.ts`: a row is already saved when a measurement on
the same date has the same printed values (weight to 10 g, lengths to 1 mm); a document is "similar"
when at least half its rows, but not all, are already saved. File names suggest a kind (English and
Portuguese: "ecografia" or "scan" → ultrasound, "nota" or "letter" → doctor's note, "boletim" →
booklet page), which the user can change.

LabTrails' adapter is `src/app/import/labAdapter.tsx`: rows already saved are those with the same
marker, value and unit on a report with the same date; a "similar" report is one on the same date where
at least three values and 60% of the comparable rows match (`src/labs/extraction/duplicates.ts`).

## Tests

`tests/unit/import.test.ts` covers intake (types, zips, nested zips, caps, a damaged zip), fingerprint
duplicates against the vault and across drops, the queue's rules, and document kinds. BabyTrails'
`tests/unit/babyImport.test.ts` covers its adapter, and `tests/e2e/import.spec.ts` the flow in the
demo (duplicates, an ultrasound kept unread, measurements not saved twice). LabTrails' browser test
`tests/e2e/import.spec.ts` runs the whole flow in the demo: a zip, all three duplicate levels, a file
kept for later, and editing a report's details.
