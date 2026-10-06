# The shared core

The parts of BabyTrails that any local-first, bring-your-own-key records app needs. LabTrails copies
this folder. Nothing here knows about children or growth; app types live in the app.

**Copying it:** copy `src/core/` as a whole and note the source commit in your README.
- Dependencies: `idb`, `hash-wasm`, `pdfjs-dist`, `@fontsource-variable/inter`, `lucide-react`, and `react` and
  `react-router` for the components.
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
| `ui/` (Trails UI v2) | Ready |

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

## `ui/`: Trails UI v2

The design system both apps use: tokens, component styles, React components and landing-page
sections. Its interface and rules are in [`ui/README.md`](ui/README.md). Each app sets only its
accent (and, for LabTrails, its flag colour) in its own stylesheet; the core's other components
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
