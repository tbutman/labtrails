// Cryptographic building blocks for the vault. WebCrypto does the encryption; hash-wasm supplies
// Argon2id, which WebCrypto doesn't have. Keys handed to callers are non-extractable.

import { argon2id } from 'hash-wasm'

export type KdfParams =
  | { alg: 'argon2id'; salt: Uint8Array<ArrayBuffer>; memoryKiB: number; iterations: number; parallelism: number }
  | { alg: 'pbkdf2-sha256'; salt: Uint8Array<ArrayBuffer>; iterations: number }

// OWASP Password Storage Cheat Sheet, checked 6 October 2026: Argon2id with 19 MiB, 2 passes and
// 1 lane, or PBKDF2-HMAC-SHA256 with 600,000 iterations.
export const DEFAULT_ARGON2ID = { memoryKiB: 19456, iterations: 2, parallelism: 1 } as const
export const DEFAULT_PBKDF2_ITERATIONS = 600_000

export type Sealed = { iv: Uint8Array<ArrayBuffer>; ct: Uint8Array<ArrayBuffer> }

const encoder = new TextEncoder()
const decoder = new TextDecoder()

export function randomBytes(length: number): Uint8Array<ArrayBuffer> {
  return crypto.getRandomValues(new Uint8Array(length))
}

export function newKdfParams(alg: KdfParams['alg'] = 'argon2id'): KdfParams {
  const salt = randomBytes(16)
  return alg === 'argon2id'
    ? { alg, salt, ...DEFAULT_ARGON2ID }
    : { alg, salt, iterations: DEFAULT_PBKDF2_ITERATIONS }
}

// Turns the passphrase into the key that wraps the data key. The passphrase is normalised so the
// same words typed on different keyboards give the same key.
export async function deriveWrappingKey(passphrase: string, params: KdfParams): Promise<CryptoKey> {
  const password = encoder.encode(passphrase.normalize('NFC'))
  if (params.alg === 'argon2id') {
    const raw = await argon2id({
      password,
      salt: params.salt,
      memorySize: params.memoryKiB,
      iterations: params.iterations,
      parallelism: params.parallelism,
      hashLength: 32,
      outputType: 'binary',
    })
    return crypto.subtle.importKey('raw', new Uint8Array(raw), 'AES-GCM', false, ['wrapKey', 'unwrapKey'])
  }
  const base = await crypto.subtle.importKey('raw', password, 'PBKDF2', false, ['deriveKey'])
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', hash: 'SHA-256', salt: params.salt, iterations: params.iterations },
    base,
    { name: 'AES-GCM', length: 256 },
    false,
    ['wrapKey', 'unwrapKey'],
  )
}

// A fresh data key. It's extractable only so it can be wrapped once; callers keep the unwrapped,
// non-extractable copy.
export function generateDataKey(): Promise<CryptoKey> {
  return crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt'])
}

export async function wrapDataKey(dataKey: CryptoKey, wrappingKey: CryptoKey, aad: string): Promise<Sealed> {
  const iv = randomBytes(12)
  const ct = new Uint8Array(
    await crypto.subtle.wrapKey('raw', dataKey, wrappingKey, { name: 'AES-GCM', iv, additionalData: encoder.encode(aad) }),
  )
  return { iv, ct }
}

// Fails (throws) when the wrapping key is wrong: AES-GCM authentication catches it.
export function unwrapDataKey(
  wrapped: Sealed,
  wrappingKey: CryptoKey,
  aad: string,
  extractable = false,
): Promise<CryptoKey> {
  return crypto.subtle.unwrapKey(
    'raw',
    wrapped.ct,
    wrappingKey,
    { name: 'AES-GCM', iv: wrapped.iv, additionalData: encoder.encode(aad) },
    { name: 'AES-GCM', length: 256 },
    extractable,
    ['encrypt', 'decrypt'],
  )
}

export async function seal(key: CryptoKey, plaintext: Uint8Array<ArrayBuffer>, aad: string): Promise<Sealed> {
  const iv = randomBytes(12)
  const ct = new Uint8Array(
    await crypto.subtle.encrypt({ name: 'AES-GCM', iv, additionalData: encoder.encode(aad) }, key, plaintext),
  )
  return { iv, ct }
}

export async function open(key: CryptoKey, sealed: Sealed, aad: string): Promise<Uint8Array<ArrayBuffer>> {
  return new Uint8Array(
    await crypto.subtle.decrypt({ name: 'AES-GCM', iv: sealed.iv, additionalData: encoder.encode(aad) }, key, sealed.ct),
  )
}

export function sealJson(key: CryptoKey, value: unknown, aad: string): Promise<Sealed> {
  return seal(key, encoder.encode(JSON.stringify(value)), aad)
}

export async function openJson<T>(key: CryptoKey, sealed: Sealed, aad: string): Promise<T> {
  return JSON.parse(decoder.decode(await open(key, sealed, aad))) as T
}
