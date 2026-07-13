class MemoryCache {
  constructor({ ttlMs, maxEntries }) {
    this.ttlMs = ttlMs
    this.maxEntries = maxEntries
    this.entries = new Map()
    this.processing = new Map()
  }

  get(key) {
    const entry = this.entries.get(key)
    if (!entry) return null

    if (entry.expiresAt <= Date.now()) {
      this.entries.delete(key)
      return null
    }

    return entry.value
  }

  set(key, value) {
    this.clearExpired()

    if (this.entries.size >= this.maxEntries) {
      const oldestKey = this.entries.keys().next().value
      if (oldestKey !== undefined) this.entries.delete(oldestKey)
    }

    this.entries.set(key, {
      value,
      expiresAt: Date.now() + this.ttlMs
    })
  }

  clearExpired() {
    const now = Date.now()
    for (const [key, entry] of this.entries.entries()) {
      if (entry.expiresAt <= now) this.entries.delete(key)
    }
  }

  async once(key, factory) {
    let promise = this.processing.get(key)

    if (!promise) {
      promise = Promise.resolve()
        .then(factory)
        .finally(() => this.processing.delete(key))

      this.processing.set(key, promise)
    }

    return promise
  }
}

module.exports = { MemoryCache }
