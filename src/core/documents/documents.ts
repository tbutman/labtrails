// Documents: PDFs and photos stored encrypted in the vault. This is the one record type the core
// defines; `kind` and `meta` belong to the app.

import type { RecordStore } from '../store/types'

export type DocumentRecord<Kind extends string = string, Meta = unknown> = {
  id: string
  profileId: string
  date: string
  kind: Kind
  title: string
  mimeType: SupportedType
  bytes: number
  blobId: string
  createdAt: string
  meta?: Meta
}

export const SUPPORTED_TYPES = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'image/gif'] as const
export type SupportedType = (typeof SUPPORTED_TYPES)[number]

// Anthropic accepts up to 32 MB per request; leave room for the prompt.
export const MAX_DOCUMENT_BYTES = 25 * 1024 * 1024

export class DocumentError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'DocumentError'
  }
}

// The file's real type, from its first bytes. The name and the browser's guess can't be trusted, and
// the viewer and the AI both need to know what they're getting.
export function sniffType(head: Uint8Array): SupportedType | undefined {
  const starts = (...sig: number[]) => sig.every((b, i) => head[i] === b)
  if (starts(0x25, 0x50, 0x44, 0x46, 0x2d)) return 'application/pdf' // %PDF-
  if (starts(0xff, 0xd8, 0xff)) return 'image/jpeg'
  if (starts(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a)) return 'image/png'
  if (starts(0x47, 0x49, 0x46, 0x38)) return 'image/gif' // GIF8
  if (starts(0x52, 0x49, 0x46, 0x46) && head[8] === 0x57 && head[9] === 0x45 && head[10] === 0x42 && head[11] === 0x50) {
    return 'image/webp' // RIFF....WEBP
  }
  return undefined
}

export async function readDocumentFile(file: Blob): Promise<{ bytes: Uint8Array<ArrayBuffer>; mimeType: SupportedType }> {
  if (file.size === 0) throw new DocumentError('That file is empty.')
  if (file.size > MAX_DOCUMENT_BYTES) throw new DocumentError('That file is larger than 25 MB.')
  const bytes = new Uint8Array(await file.arrayBuffer())
  const mimeType = sniffType(bytes.subarray(0, 16))
  if (!mimeType) {
    throw new DocumentError('Use a PDF or a photo (JPEG, PNG, WebP or GIF). iPhone photos in HEIC format can be shared as JPEG.')
  }
  return { bytes, mimeType }
}

export type NewDocument<Kind extends string, Meta> = Pick<DocumentRecord<Kind, Meta>, 'profileId' | 'date' | 'kind' | 'title' | 'meta'>

export async function addDocument<Kind extends string, Meta>(
  store: RecordStore,
  file: Blob,
  fields: NewDocument<Kind, Meta>,
): Promise<DocumentRecord<Kind, Meta>> {
  const { bytes, mimeType } = await readDocumentFile(file)
  const blobId = await store.putBlob(bytes)
  const doc: DocumentRecord<Kind, Meta> = {
    id: crypto.randomUUID(),
    ...fields,
    mimeType,
    bytes: bytes.length,
    blobId,
    createdAt: new Date().toISOString(),
  }
  await store.put('documents', doc)
  return doc
}

export async function deleteDocument(store: RecordStore, doc: Pick<DocumentRecord, 'id' | 'blobId'>): Promise<void> {
  await store.deleteBlob(doc.blobId)
  await store.delete('documents', doc.id)
}

export async function documentBytes(store: RecordStore, doc: Pick<DocumentRecord, 'blobId'>): Promise<Uint8Array<ArrayBuffer>> {
  const bytes = await store.getBlob(doc.blobId)
  if (!bytes) throw new DocumentError('This document is missing from the vault.')
  return bytes
}

export function listDocuments<Kind extends string, Meta>(store: RecordStore, profileId?: string) {
  return store
    .list<DocumentRecord<Kind, Meta>>('documents')
    .then((docs) => docs.filter((d) => profileId === undefined || d.profileId === profileId).sort((a, b) => b.date.localeCompare(a.date)))
}
