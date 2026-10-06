# The shared core

The parts of BabyTrails that any local-first, bring-your-own-key records app needs. LabTrails copies
this folder. Nothing here knows about children or growth; app types live in the app.

**Copying it:** copy `src/core/` as a whole and note the source commit in your README.
- Dependencies: `idb`, `hash-wasm`, `pdfjs-dist`, `@fontsource/quicksand`, and `react` for the components.
- Also copy `scripts/copy-pdfjs.mjs` and run it before `dev`, `build` and `test` (it copies pdf.js's
  WebAssembly decoders, fonts and character maps into `public/vendor/pdfjs/`, git-ignored, so the
  viewer loads nothing from other origins).
- Tests live in `tests/unit/` (`vault`, `backup`, `settings`, `documents`, `review`, `ai`); copy them
  too. `fake-indexeddb` is a dev dependency for them.
- Your CSP needs `script-src 'self' 'wasm-unsafe-eval'` (Argon2id and pdf.js), `worker-src 'self'`
  (pdf.js) and `connect-src 'self' https://api.anthropic.com`.

## Status

| Part | Status |
| --- | --- |
| `vault/` | Ready |
| `store/` | Ready |
| `backup/` | Ready |
| `settings/` | Ready |
| `documents/` | Ready |
| `review/` | Ready |
| `ai/` | Ready |
| `ui/` (design tokens) | Ready |

## Opening

```ts
import { openTrails } from './core'

const { vault, store, db } = await openTrails({
  appId: 'babytrails', // names the IndexedDB database and is bound into every encryption
  collections: ['children', 'measurements', 'visits', 'summaries'], // the app's own
})
```

The core adds its own collections, `documents` and `settings`. Using a collection that wasn't
registered throws `UnknownCollectionError`, which catches typos.

## `vault/`: passphrase and keys

```ts
await vault.exists()                 // is there a vault on this device?
await vault.create(passphrase)       // ≥ 12 characters (WeakPassphraseError); unlocks it
await vault.unlock(passphrase)       // WrongPassphraseError if it doesn't open
vault.lock()                         // drops the key from memory
vault.isUnlocked
await vault.changePassphrase(current, next)  // re-wraps the key; data isn't re-encrypted
const stop = vault.subscribe((unlocked) => …)
const stopAutoLock = startAutoLock(vault, minutes)  // from './core/vault/autoLock'
```

- A random 256-bit data key encrypts everything (AES-256-GCM). It's wrapped by a key derived from
  the passphrase with Argon2id (19 MiB, 2 passes, 1 lane) or, if set, PBKDF2-SHA256 600,000. The
  algorithm and settings are stored with the vault, so they can be raised later.
- While unlocked, the data key exists only as a non-extractable `CryptoKey`.
- Tests pass `kdf` to `openTrails` to make key derivation fast. Apps shouldn't.

## `store/`: encrypted records and files

```ts
await store.put('children', { id, ...fields })   // any JSON record with a string id
await store.get<Child>('children', id)
await store.list<Child>('children')
await store.delete('children', id)

const blobId = await store.putBlob(fileOrBytes)  // encrypted in 1 MiB chunks
const bytes = await store.getBlob(blobId)        // Uint8Array
await store.deleteBlob(blobId)
```

- Every call throws `VaultLockedError` when the vault is locked.
- Each record is bound to its collection and ID, and each file chunk to its position, so moved,
  reordered, truncated or edited data fails to decrypt instead of showing something wrong.
- What IndexedDB shows without the passphrase: collection names, random IDs, how many records and
  files there are, and their approximate sizes.

## `backup/`: export and import

```ts
import { exportBackup, backupFileName, readBackup, restoreBackup } from './core/backup/backup'

const file = await exportBackup(db, 'babytrails')        // a Blob; save it as backupFileName(appId)
const backup = await readBackup(fileFromUser, 'babytrails')  // BackupError if it isn't one
vault.lock()
await restoreBackup(db, backup, passphrase)              // replaces everything on this device
await vault.unlock(passphrase)
```

- A backup is the vault exactly as stored, already encrypted, as JSON. The vault's passphrase opens
  it. Every collection is included, even ones this version of the app doesn't know.
- `restoreBackup` first checks the passphrase and decrypts every record and file; if anything
  fails, nothing on the device changes. Then it replaces everything in one transaction.
- Lock before restoring and unlock afterwards, so the vault picks up the restored key.

## Reading and writing without caring which store

`RecordStore` (in `store/types.ts`) is the interface screens should use. `EncryptedStore` implements
it, and so does `MemoryStore`, an in-memory store for demo mode that writes nothing to the device.

```ts
import { MemoryStore, type RecordStore } from './core'
const demo: RecordStore = new MemoryStore()   // same put/get/list/delete and blob methods
```

## `settings/`

```ts
const core = await loadCoreSettings(store)  // theme, autoLockMinutes, ai { provider, model, apiKey },
                                            // lastBackupAt, backupNudgeDismissedAt, changesSinceBackup
await saveCoreSettings(store, { ...core, autoLockMinutes: 10 })
const app = await loadAppSettings(store, { units: 'metric' })  // the app's own part, with defaults
await saveAppSettings(store, app)
```

Settings are stored encrypted, in the `settings` collection, so the API key is never in plain form.

## `ui/`: design tokens

`ui/tokens.css` holds the shared "Honey and ink" tokens: backgrounds, surfaces, text, borders, the
primary button, radii, spacing, type (Quicksand for headings, system UI for body) and chart styles,
in light and dark mode (following the system, or `data-theme="light|dark"` on `<html>`).

Each app sets only its accent, and optionally a flag colour, in its own stylesheet loaded after the
tokens:

```css
:root {
  --accent-fill-light: #e0a21e;  /* fills and chart points */
  --accent-text-light: #9a6400;  /* text and lines, ≥ 4.5:1 on the background */
  --accent-fill-dark: #f2c45a;   /* also the dark-mode primary button, with ink text */
  --accent-text-dark: #f2c45a;
  /* optional, for flags: --flag-light, --flag-tint-light, --flag-dark, --flag-tint-dark */
}
```

Components then use `--accent-fill`, `--accent-text`, `--flag` and `--flag-tint`, which follow the
current mode. Fonts are self-hosted with `@fontsource/quicksand` (600 and 700, Latin).

## `documents/`: PDFs and photos

```ts
import { addDocument, deleteDocument, documentBytes, listDocuments, DocumentError } from './core'
import { DocumentViewer } from './core/documents/DocumentViewer'

type MyDoc = DocumentRecord<'lab-report' | 'other', { labName?: string }>
const doc = await addDocument<MyDoc['kind'], MyDoc['meta']>(store, file, {
  profileId, date: '2026-09-01', kind: 'lab-report', title: 'September bloods', meta: {},
})                                       // DocumentError for unknown types, empty or > 25 MB files
const docs = await listDocuments<MyDoc['kind'], MyDoc['meta']>(store, profileId)  // newest first
const bytes = await documentBytes(store, doc)
await deleteDocument(store, doc)          // removes the record and the encrypted file

<DocumentViewer store={store} doc={doc} />                          // a photo, or every PDF page
<DocumentViewer store={store} doc={doc} page={2} onPageChange={setPage} />  // one page, with buttons
```

- `DocumentRecord` is `{ id, profileId, date, kind, title, mimeType, bytes, blobId, createdAt, meta? }`,
  stored in the core's `documents` collection. `profileId` is whoever your app tracks.
- The type comes from the file's first bytes (`sniffType`), not its name: PDF, JPEG, PNG, WebP or
  GIF. HEIC photos are refused with a message to share them as JPEG.
- pdf.js loads only when a PDF is opened.

## `review/`: propose → review → confirm

```tsx
import { ReviewPanel } from './core/review/ReviewPanel'
import type { Column, ProposedRow, ConfirmedRow } from './core/review/model'

const columns: Column[] = [
  { key: 'date', label: 'Date', type: 'date', required: true },
  { key: 'value', label: 'Value', type: 'number', validate: (v) => (Number(v) > 1000 ? 'Check this.' : undefined) },
  { key: 'unit', label: 'Unit', type: 'choice', options: [{ value: 'g/L', label: 'g/L' }, { value: 'mg/dL', label: 'mg/dL' }] },
  { key: 'name', label: 'Name as printed', type: 'text' },
]
const proposed: ProposedRow[] = [
  { values: { date: '03/04/2026', value: '5,4', unit: 'g/L', name: 'Hemoglobina' }, confidence: 'low', sourceText: '…', page: 1 },
]

<ReviewPanel
  columns={columns}
  proposed={proposed}
  source={(page) => <DocumentViewer store={store} doc={doc} page={page ?? 1} onPageChange={…} />}
  onConfirm={async (rows: ConfirmedRow[]) => { /* save them */ }}
  onCancel={…}
  confirmLabel={(n) => `Save ${n} results`}
/>
```

- Every row starts **pending**. The user ticks "This matches the document" to accept it, edits any
  field, removes rows or adds their own.
- `onConfirm` receives **only accepted rows that pass every check**, converted: numbers as numbers
  (decimal commas handled, "1.234,5" too), dates as `YYYY-MM-DD`. Pending, removed and invalid rows
  never reach the app. The rules are in `review/model.ts` (`confirmedRows`) and unit-tested.
- Column validators receive the cleaned value (a number string with a decimal point, or an ISO date).
- When dates could be read either way (03/04/2026) and no date in the document settles it, the panel
  asks "day first or month first?" before those rows can be saved.
- Low-confidence rows are highlighted; `sourceText` is shown as a quote, with a "Show page" link
  when `page` is set.

## `ai/`: Anthropic from the browser

```ts
import { askJson, askText, pdfBlock, imageBlock, shrinkImage, AiError } from './core/ai/client'
import { redactNames } from './core/ai/redact'
import { MODELS, DEFAULT_MODEL, estimateCents } from './core/ai/models'

const { value } = await askJson(
  { apiKey, model, system: SYSTEM_PROMPT, content: [pdfBlock(bytes), { type: 'text', text: PROMPT }], maxTokens: 4000 },
  SCHEMA,            // JSON schema for structured outputs; never put personal data in it
  toProposedRows,    // your validator: throw AiError('output', …) or return clean data
)
const { text } = await askText({ apiKey, model, system, content: [{ type: 'text', text: redactNames(facts, [name, nickname], 'the person') }] })
```

- Calls `https://api.anthropic.com/v1/messages` with the user's key and
  `anthropic-dangerous-direct-browser-access: true`; no cookies, no referrer.
- Errors are `AiError` with `kind`: `key`, `limit`, `busy`, `request`, `network` or `output`, and a
  message written for users. The key never appears in messages.
- `shrinkImage` resizes photos to a 2,000 px long edge (JPEG) before sending.
- Models: Sonnet 5.5 (default) and Opus 5.5, in `models.ts`, with prices for rough estimates.

Components:

```tsx
import { SendSheet, AiOutput } from './core/ai/SendSheet'
import { Markdown } from './core/ai/Markdown'
import { ApiKeySettings } from './core/ai/ApiKeySettings'

<SendSheet appName="LabTrails" sending={['This report (PDF, 120 kB)']} notSending={['Your name and date of birth']}
  notes={['The report itself may show your name.']} model={model}
  estimate={{ inputTokens: 6000, outputTokens: 600 }} busy={busy} onSend={send} onCancel={cancel} />
<AiOutput label="Summary of this report" note="Written by AI. It can be wrong, and it isn't medical advice.">
  <Markdown text={aiText} />   {/* paragraphs, lists, **bold**; never HTML, links or images */}
</AiOutput>
<ApiKeySettings apiKey={core.ai.apiKey} model={core.ai.model} onSave={({ apiKey, model }) => saveCore({ ...core, ai: { ...core.ai, apiKey, model } })} />
```

- `SendSheet` always names Anthropic, says the request doesn't go through the app's server, and
  states Anthropic's data terms (no training on API content; deleted within 30 days, up to 2 years
  if flagged; checked 6 October 2026). Nothing is sent until the user taps **Send**.
