// Taking files in: several at once, or zip files, opened entirely in the browser. Each file is checked
// by its real type (its first bytes, not its name), given a SHA-256 fingerprint so duplicates can be
// recognized, and anything unusable is listed with a reason instead of failing the whole batch.
//
// Zips are untrusted input: nested zips are skipped, and the number of entries, the size of each file
// and the total unpacked size are capped, so a crafted "zip bomb" can't exhaust memory.

import { unzip, type Unzipped } from 'fflate'
import { MAX_DOCUMENT_BYTES, sniffType, type SupportedType } from '../documents/documents'

export type IntakeLimits = {
  /** Files accepted in one batch, after unpacking zips. */
  maxFiles: number
  /** Largest single file (the AI provider's request limit sets this). */
  maxFileBytes: number
  /** Largest zip file accepted. */
  maxZipBytes: number
  /** Total unpacked size across all zips in the batch. */
  maxUnpackedBytes: number
}

export const DEFAULT_LIMITS: IntakeLimits = {
  maxFiles: 60,
  maxFileBytes: MAX_DOCUMENT_BYTES,
  maxZipBytes: 200 * 1024 * 1024,
  maxUnpackedBytes: 400 * 1024 * 1024,
}

export type IntakeFile = {
  id: string
  /** The file's name, or for a file from a zip, its path inside the zip. */
  name: string
  /** The zip it came from, if any. */
  zip?: string
  bytes: Uint8Array<ArrayBuffer>
  mimeType: SupportedType
  sha256: string
  /** Another file in this batch with identical contents, if this is a repeat. */
  sameAs?: string
}

export type Skipped = { name: string; reason: string }

export type IntakeResult = { files: IntakeFile[]; skipped: Skipped[] }

const isZip = (b: Uint8Array) => b[0] === 0x50 && b[1] === 0x4b && (b[2] === 0x03 || b[2] === 0x05) && (b[3] === 0x04 || b[3] === 0x06)

export async function sha256(bytes: Uint8Array<ArrayBuffer>): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

/** Names inside a zip that are never documents: folders, macOS metadata, hidden files. */
function ignoredEntry(path: string): boolean {
  const base = path.split('/').pop() ?? ''
  return path.endsWith('/') || path.startsWith('__MACOSX/') || path.includes('/__MACOSX/') || base.startsWith('.') || base === 'Thumbs.db' || base === 'desktop.ini'
}

function unzipAsync(data: Uint8Array, filter: (f: { name: string; originalSize: number }) => boolean): Promise<Unzipped> {
  return new Promise((resolve, reject) => unzip(data, { filter }, (err, out) => (err ? reject(err) : resolve(out))))
}

/**
 * Reads the chosen files, unpacking zips, and returns the usable files (with fingerprints) and the
 * skipped ones with a reason. Files with identical contents within the batch are kept but marked
 * `sameAs`, so the queue can show them as duplicates.
 */
export async function intake(input: File[] | Blob[], limits: IntakeLimits = DEFAULT_LIMITS): Promise<IntakeResult> {
  const files: IntakeFile[] = []
  const skipped: Skipped[] = []
  let unpacked = 0

  const add = async (name: string, bytes: Uint8Array<ArrayBuffer>, zip?: string) => {
    const label = zip ? `${zip} › ${name}` : name
    if (files.length >= limits.maxFiles) return skipped.push({ name: label, reason: `More than ${limits.maxFiles} files at once; add the rest separately.` })
    if (bytes.length === 0) return skipped.push({ name: label, reason: 'The file is empty.' })
    if (bytes.length > limits.maxFileBytes) return skipped.push({ name: label, reason: `Larger than ${Math.round(limits.maxFileBytes / 1024 / 1024)} MB.` })
    if (isZip(bytes)) return skipped.push({ name: label, reason: zip ? 'A zip inside a zip; unpack it first.' : 'Not a usable zip.' })
    const mimeType = sniffType(bytes.subarray(0, 16))
    if (!mimeType) return skipped.push({ name: label, reason: 'Not a PDF or a photo (JPEG, PNG, WebP or GIF). iPhone photos in HEIC format can be shared as JPEG.' })
    const hash = await sha256(bytes)
    const first = files.find((f) => f.sha256 === hash)
    files.push({ id: crypto.randomUUID(), name, ...(zip ? { zip } : {}), bytes, mimeType, sha256: hash, ...(first ? { sameAs: first.id } : {}) })
  }

  for (const file of input) {
    const name = (file as File).name ?? 'file'
    const head = new Uint8Array(await file.slice(0, 8).arrayBuffer())
    if (!isZip(head)) {
      if (file.size > limits.maxFileBytes) {
        skipped.push({ name, reason: `Larger than ${Math.round(limits.maxFileBytes / 1024 / 1024)} MB.` })
        continue
      }
      await add(name, new Uint8Array(await file.arrayBuffer()), undefined)
      continue
    }

    if (file.size > limits.maxZipBytes) {
      skipped.push({ name, reason: `The zip is larger than ${Math.round(limits.maxZipBytes / 1024 / 1024)} MB.` })
      continue
    }
    let declared = 0
    let entries = 0
    let refused: string | null = null
    let out: Unzipped
    try {
      out = await unzipAsync(new Uint8Array(await file.arrayBuffer()), (entry) => {
        if (ignoredEntry(entry.name)) return false
        entries++
        if (entries > limits.maxFiles) {
          refused = `More than ${limits.maxFiles} files in the zip.`
          return false
        }
        if (entry.originalSize > limits.maxFileBytes) {
          skipped.push({ name: `${name} › ${entry.name}`, reason: `Larger than ${Math.round(limits.maxFileBytes / 1024 / 1024)} MB.` })
          return false
        }
        declared += entry.originalSize
        if (unpacked + declared > limits.maxUnpackedBytes) {
          refused = 'The zip unpacks to more than the app can safely open at once.'
          return false
        }
        return true
      })
    } catch {
      skipped.push({ name, reason: "The zip couldn't be opened (it may be damaged or password-protected)." })
      continue
    }
    if (refused) skipped.push({ name, reason: refused })
    // The sizes a zip declares can lie, so count what actually came out too.
    for (const [path, bytes] of Object.entries(out).sort(([a], [b]) => a.localeCompare(b, undefined, { numeric: true }))) {
      unpacked += bytes.length
      if (unpacked > limits.maxUnpackedBytes) {
        skipped.push({ name: `${name} › ${path}`, reason: 'The zip unpacks to more than the app can safely open at once.' })
        break
      }
      await add(path, bytes as Uint8Array<ArrayBuffer>, name)
    }
  }
  return { files, skipped }
}
