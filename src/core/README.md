# The shared core

The parts of BabyTrails that any local-first, bring-your-own-key records app needs. LabTrails copies
this folder. Nothing here knows about children or growth; app types live in the app.

**Copying it:** copy `src/core/` as a whole and note the source commit in your README.
- Dependencies: `idb`, `hash-wasm`, `pdfjs-dist`, `fflate` (zips, for `import/`), `@fontsource-variable/inter`,
  `lucide-react`, and `react` and `react-router` for the components.
- Also copy `scripts/copy-pdfjs.mjs` and run it before `dev`, `build` and `test` (it copies pdf.js's
  WebAssembly decoders, fonts and character maps into `public/vendor/pdfjs/`, git-ignored, so the
  viewer loads nothing from other origins).
- Tests live in `tests/unit/`; the core's own are listed in [`TESTS`](TESTS), one path per line, and
  copied with it. `fake-indexeddb` is a dev dependency for them.
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
| `import/` | Ready |
| `ui/` (Trails UI v2) | Ready |

## Opening

```ts
import { openTrails } from './core'

const { vault, store, db, channel } = await openTrails({
  appId: 'babytrails', // names the IndexedDB database and is bound into every encryption
  collections: ['children', 'measurements', 'visits', 'summaries'], // the app's own
})
```

The core adds its own collections, `documents` and `settings`. Using a collection that wasn't
registered throws `UnknownCollectionError`, which catches typos.

`channel` keeps the app's tabs in step (a `BroadcastChannel` named `<appId>-vault`): when one tab
locks (by hand, by auto-lock or before a restore), every tab locks; every `put` and `delete` tells
the other tabs that something changed (never what; a burst of writes sends one message); and after
"erase this vault" the other tabs reload. Subscribe to `changed` to reload lists:

```ts
channel.subscribe((m) => { if (m.type === 'changed') bumpVersion() })   // 'lock' and 'erased' are handled by the core
```

## `vault/`: passphrase and keys

```ts
await vault.exists()                 // is there a vault on this device?
await vault.create(passphrase)       // checkPassphrase rules (WeakPassphraseError); unlocks it
await vault.unlock(passphrase)       // WrongPassphraseError if it doesn't open
vault.lock()                         // drops the key from memory
vault.isUnlocked
await vault.changePassphrase(current, next)  // re-wraps the key; data isn't re-encrypted
const stop = vault.subscribe((unlocked) => …)
const stopAutoLock = startAutoLock(vault, minutes)  // from './core/vault/autoLock'
```

- A random 256-bit data key encrypts everything (AES-256-GCM). It's wrapped by a key derived from
  the passphrase with Argon2id (19 MiB, 2 passes, 1 lane) or, where WebAssembly can't run (iOS
  Lockdown Mode, for example), PBKDF2-SHA256 with 600,000 iterations. The algorithm and settings are
  stored with the vault, so they can be raised later; changing the passphrase in a browser that runs
  Argon2id moves a PBKDF2 vault to it. Opening an Argon2id vault without WebAssembly throws
  `KdfUnavailableError`, whose message says what to do.
- New passphrases (`checkPassphrase(passphrase, appName)` in `vault/passphrase.ts`): at least 12
  characters, at least 4 different ones, not one word repeated, not built from the app's name. It
  also gives a three-step hint (`weak`, `ok`, `strong`), shown by `PassphraseStrength`.
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
import { exportBackup, backupFileName, readBackup, verifyBackup, replaceWithBackup } from './core/backup/backup'

const file = await exportBackup(db, 'babytrails')        // a Blob; save it as backupFileName(appId)
const backup = await readBackup(fileFromUser, 'babytrails')  // BackupError if it isn't one
await verifyBackup(backup, passphrase)                   // WrongPassphraseError, BackupError; nothing changes
vault.lock()                                             // only once it's verified
await replaceWithBackup(db, backup)                      // replaces everything on this device
await vault.unlock(passphrase)
```

`restoreBackup(db, backup, passphrase)` is `verifyBackup` and then `replaceWithBackup`, for callers
that have already locked. The forms in `backup/BackupForms.tsx` (below) do all of this.

- A backup is the vault exactly as stored, already encrypted, as JSON. The vault's passphrase opens
  it. Every collection is included, even ones this version of the app doesn't know.
- `restoreBackup` first checks the passphrase and decrypts every record and file; if anything
  fails, nothing on the device changes. Then it replaces everything in one transaction.
- Lock before replacing and unlock afterwards, so the vault picks up the restored key. Verify first,
  so a wrong passphrase doesn't lock anyone out of what's already there.

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

## `import/`: several documents at once

The shared import: files or zips (opened in the browser, with limits), SHA-256 fingerprints so
documents already in the vault are set aside before anything is sent, one agreement for a batch,
documents stored first and then read one by one with retry, a review queue, and a summary. Apps plug
in through an `ImportAdapter`; documents not read yet carry `meta.importStatus: 'unread'`. Interface
and rules: [`import/README.md`](import/README.md).

## `ui/`: Trails UI v2

The design system both apps use: tokens, component styles, React components and landing-page
sections. Its interface and rules are in [`ui/README.md`](ui/README.md). Each app sets only its
accent (and, for LabTrails, its flag color) in its own stylesheet; the core's other components
(ReviewPanel, SendSheet, AiOutput, DocumentViewer, ApiKeySettings, UpdatePrompt) are styled by their
class names.

## `ui/UpdatePrompt.tsx`: "a new version is ready"

```tsx
import { UpdatePrompt } from './core/ui/UpdatePrompt'
<UpdatePrompt appName="LabTrails" locksVault={mode === 'unlocked'} />   // near the top of the app
```

Needs `vite-plugin-pwa` with `registerType: 'prompt'` and `injectRegister: false`, and
`"vite-plugin-pwa/vanillajs"` in the tsconfig `types`. It registers the service worker, checks for
a new version every 30 minutes and when the app comes back to the foreground, and shows a banner
when one has downloaded. It switches only when the user taps **Reload** (a reload locks the vault
and drops anything being typed). Without it, a new version waits until every tab or the installed
app is closed.

## Shared forms and wording

| Module | What it gives |
| --- | --- |
| `vault/VaultForms.tsx` | `ChangePassphrase`, `PassphraseStrength`, `EraseVault`, `ForgotPassphrase` |
| `vault/erase.ts` | `eraseEverything` (the database, Cache Storage, the service worker, local and session storage) and `takeErasedNotice` |
| `backup/BackupForms.tsx` | `ExportBackup`, `RestoreBackup`, `RESTORED_MESSAGE` |
| `ask/wording.ts` | `BANNED_PHRASES`, `BANNED_WORDS`, `BANNED_WORDS_TEXT`, `bannedPhrase`, `summaryWordingError`, `UNCHECKED_NUMBERS_NOTE` |
| `format.ts` | `formatDate` ("Sep 19, 2026") and `formatShortDate` ("Sep 19"), US dates |
| `ui/copy.ts` | `possessive`, `disclaimer`, `demoNote` |
| `ui/RouteError.tsx` | `RouteError`, the router's `errorElement` |

## Adopting the Trails review changes (October 7, 2026)

What an app does after syncing the core at or after these changes. BabyTrails has done all of it;
see its `src/app/` for working examples.

- **CORE-01, erase this vault.** In Settings, a card with
  `<EraseVault appId appName db={trails.db} vault={trails.vault} channel={trails.channel} home="/app" />`.
  Under the Unlock form,
  `<ForgotPassphrase {...sameProps} onRestore={() => showRestore()} />`. On the setup screen, show
  "Everything is deleted from this browser." once when `takeErasedNotice(appId)` is true (read it in
  a `useState` initializer). Document the erase in THREAT_MODEL.
- **CORE-02, change passphrase.** Replace the app's own form with
  `<ChangePassphrase vault={trails.vault} appName="LabTrails" />`. It asks for the new passphrase twice,
  checks it with `checkPassphrase`, and says when the vault uses PBKDF2.
- **CORE-03, backup and restore.** Replace the app's `Backup.tsx` with
  `<ExportBackup db appId contents="all your results" lastBackupAt={core.lastBackupAt} onExported={…} />`
  and `<RestoreBackup db vault appId appName onRestored={…} />`. `onRestored` runs with the vault
  locked and replaced: switch to the Unlock form and show `RESTORED_MESSAGE` over it (BabyTrails
  keeps a `notice` in its session for that). While restoring, the setup screen's heading is
  "Restore from a backup". Pass `intro={false}` where the page already says what to choose.
- **CORE-04, wording.** Every answer is checked against `BANNED_PHRASES` (the `banned` you pass to
  `askQuestion` or `checkAnswer` is now added to it, not instead of it). Check summaries too: if
  `bannedPhrase(text)` finds something, don't save and show `summaryWordingError(appName)`; for a
  summary of a document, pass `{ allowQuoted: true }` and tell the prompt to quote the document's
  own judgments. Show `UNCHECKED_NUMBERS_NOTE` under summaries. Use `BANNED_WORDS_TEXT` in prompts,
  so the prompt and the check list the same words.
- **CORE-05, signs.** Nothing to change: "lost 120 g" against +120 is now withheld. Tell the AI to
  write the minus sign or "lost" for negative numbers.
- **CORE-06, errors.** New `AiError` kinds `refused` and `offline`; messages are ready to show.
  The zero-data-retention note moved to `ApiKeySettings`; pass it `appName`.
- **CORE-07, PBKDF2.** Nothing to change; show `KdfUnavailableError`'s message on Unlock and setup.
- **CORE-08, passphrase checks.** On setup, check with `checkPassphrase(passphrase, appName)` and
  show `<PassphraseStrength passphrase appName />` under the field.
- **CORE-09, tabs.** Subscribe to `channel` for `changed` (above). Mention several tabs in
  THREAT_MODEL.
- **CORE-10, CORE-11.** Nothing to change (check marks on `ChipGroup`, 44 px touch targets).
- **CORE-12, privacy notes.** `shrinkImage` now always re-encodes photos; add `PHOTO_NOTE` (from
  `ai/client.ts`) to send sheets that send photos (the shared import does it itself). Add
  `FOLLOW_UP_NOTE` (from `ask/ask.ts`) to the send sheet of a follow-up question. The send sheet's
  terms line is dated and links Anthropic's terms; `ExportBackup` says the backup includes the AI key.
- **CORE-13, copy.** The footer lists the sister app under "Also from Trails". The send sheet says
  "the {app} server". Use `disclaimer(appName, 'your doctor')` and `demoNote('person')`. Dates in
  the shared import use `formatDate`.
- **LAB-14.** Set `settingsPath` (for example `'/app/settings#ai'`) on the import adapter, so "add one
  in Settings" is a link.
- **BABY-05.** Give the router's root route `errorElement: <RouteError home="/app" />`.
- **X-10.** `scripts/sync-core.sh` should copy the test files listed in `src/core/TESTS`.
- **Q1, dates on the review screen.** Nothing to change: each date field shows the date as printed
  and as read ("02.10.26 → Oct 2, 2026").
- **BABY-20, title and date at import.** The queue offers "Title and date" for each new file. If your
  adapter's `save` re-dates the document from what was read, set `datesFromContents: true` and leave
  the date alone when `doc.meta.datedByUser` is set.
