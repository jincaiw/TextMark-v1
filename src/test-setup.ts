Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })

// jsdom's localStorage is unavailable under Node without --localstorage-file.
// A minimal in-memory stub keeps persistence code paths (which read storage at
// call time) exercisable in tests instead of silently falling into their
// catch-and-forget branches.
const memoryStorage = new Map<string, string>()
Object.assign(globalThis, {
  localStorage: {
    getItem: (key: string) => memoryStorage.get(key) ?? null,
    setItem: (key: string, value: string) => void memoryStorage.set(key, value),
    removeItem: (key: string) => void memoryStorage.delete(key),
    clear: () => void memoryStorage.clear(),
    key: (index: number) => [...memoryStorage.keys()][index] ?? null,
    get length() {
      return memoryStorage.size
    },
  },
})
