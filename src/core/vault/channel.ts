// Keeps the app's tabs in step (CORE-09): when one tab locks, every tab locks; when one tab saves,
// the others reload their lists; after "erase this vault", the others start again. Messages carry
// no data, only what happened. Browsers without BroadcastChannel simply don't share.

export type VaultMessage = { type: 'lock' } | { type: 'changed' } | { type: 'erased' }

type Listener = (message: VaultMessage) => void

// Changes are sent at most this often: a batch import writes many records in a row.
const CHANGED_DELAY_MS = 150

export class VaultChannel {
  readonly #channel: BroadcastChannel | null
  readonly #listeners = new Set<Listener>()
  #changedTimer: ReturnType<typeof setTimeout> | undefined

  constructor(appId: string) {
    this.#channel = typeof BroadcastChannel === 'undefined' ? null : new BroadcastChannel(`${appId}-vault`)
    // Node (the unit tests) would otherwise keep running while a channel is open.
    ;(this.#channel as { unref?: () => void } | null)?.unref?.()
    this.#channel?.addEventListener('message', (e: MessageEvent<VaultMessage>) => {
      for (const listener of this.#listeners) listener(e.data)
    })
  }

  /** Tells the other tabs. A tab never hears its own messages. */
  post(message: VaultMessage): void {
    if (!this.#channel) return
    if (message.type !== 'changed') {
      this.#channel.postMessage(message)
      return
    }
    if (this.#changedTimer !== undefined) return
    this.#changedTimer = setTimeout(() => {
      this.#changedTimer = undefined
      this.#channel?.postMessage(message)
    }, CHANGED_DELAY_MS)
  }

  /** Listens to the other tabs. */
  subscribe(listener: Listener): () => void {
    this.#listeners.add(listener)
    return () => this.#listeners.delete(listener)
  }

  close(): void {
    clearTimeout(this.#changedTimer)
    this.#channel?.close()
  }
}
