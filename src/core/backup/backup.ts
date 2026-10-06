// Backup files. A backup is the vault exactly as stored, already encrypted, so exporting adds no new
// cryptography and never writes plain data to disk. The same passphrase opens it. Collections the
// core doesn't know about are included, because rows are copied as they are.

import type { BlobRow, Db, RecordRow, VaultHeader } from '../store/db'
import { open, unwrapDataKey, deriveWrappingKey, type Sealed } from '../vault/crypto'
import { WrongPassphraseError } from '../vault/vault'
import { VAULT_FORMAT } from '../store/db'

export const BACKUP_FORMAT = 'trails-backup'
export const BACKUP_VERSION = 1

export type BackupFile = {
  format: typeof BACKUP_FORMAT
  version: number
  appId: string
  exportedAt: string
  header: VaultHeader
  records: RecordRow[]
  blobs: BlobRow[]
}

export class BackupError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'BackupError'
  }
}

// Binary values become {"$b64": "..."} in JSON.
function replacer(_key: string, value: unknown) {
  if (value instanceof Uint8Array) return { $b64: toBase64(value) }
  return value
}

function reviver(_key: string, value: unknown) {
  if (value && typeof value === 'object' && '$b64' in value && typeof value.$b64 === 'string') {
    return fromBase64(value.$b64)
  }
  return value
}

function toBase64(bytes: Uint8Array): string {
  let binary = ''
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  return btoa(binary)
}

function fromBase64(text: string): Uint8Array<ArrayBuffer> {
  const binary = atob(text)
  const out = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i)
  return out
}

export async function exportBackup(db: Db, appId: string): Promise<Blob> {
  const tx = db.transaction(['meta', 'records', 'blobs'], 'readonly')
  const [header, records, blobs] = await Promise.all([
    tx.objectStore('meta').get('vault'),
    tx.objectStore('records').getAll(),
    tx.objectStore('blobs').getAll(),
  ])
  await tx.done
  if (!header) throw new BackupError('There is nothing to back up yet.')
  const file: BackupFile = {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    appId,
    exportedAt: new Date().toISOString(),
    header,
    records,
    blobs,
  }
  return new Blob([JSON.stringify(file, replacer)], { type: 'application/json' })
}

export function backupFileName(appId: string, date = new Date()): string {
  return `${appId}-backup-${date.toISOString().slice(0, 10)}.json`
}

export async function readBackup(file: Blob, appId: string): Promise<BackupFile> {
  let parsed: BackupFile
  try {
    parsed = JSON.parse(await file.text(), reviver) as BackupFile
  } catch {
    throw new BackupError("This file isn't a backup.")
  }
  if (parsed?.format !== BACKUP_FORMAT) throw new BackupError("This file isn't a backup.")
  if (parsed.appId !== appId) throw new BackupError('This backup belongs to a different app.')
  if (parsed.version > BACKUP_VERSION || parsed.header.format > VAULT_FORMAT) {
    throw new BackupError('This backup was made by a newer version of the app. Update the app first.')
  }
  return parsed
}

// Checks the passphrase and that every record and file in the backup decrypts, before anything on
// this device is touched.
export async function verifyBackup(backup: BackupFile, passphrase: string): Promise<void> {
  const aad = `${backup.appId}/vault-key/v${backup.header.format}`
  const wrappingKey = await deriveWrappingKey(passphrase, backup.header.kdf)
  let key: CryptoKey
  try {
    key = await unwrapDataKey(backup.header.wrappedKey, wrappingKey, aad)
  } catch {
    throw new WrongPassphraseError()
  }
  try {
    for (const row of backup.records) {
      await open(key, row.sealed, `${backup.appId}/record/${row.collection}/${row.id}`)
    }
    for (const row of backup.blobs) {
      for (const [i, chunk] of row.chunks.entries()) {
        await open(key, chunk as Sealed, `${backup.appId}/blob/${row.id}/${i}/${row.chunks.length}`)
      }
    }
  } catch {
    throw new BackupError('This backup is damaged: some of its contents could not be decrypted.')
  }
}

// Replaces everything on this device with the backup, in one transaction: either all of it is
// restored or nothing changes.
export async function restoreBackup(db: Db, backup: BackupFile, passphrase: string): Promise<void> {
  await verifyBackup(backup, passphrase)
  const tx = db.transaction(['meta', 'records', 'blobs'], 'readwrite')
  await Promise.all([tx.objectStore('meta').clear(), tx.objectStore('records').clear(), tx.objectStore('blobs').clear()])
  await tx.objectStore('meta').put(backup.header)
  for (const row of backup.records) await tx.objectStore('records').put(row)
  for (const row of backup.blobs) await tx.objectStore('blobs').put(row)
  await tx.done
}
