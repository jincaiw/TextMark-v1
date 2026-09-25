import { rankProjectDocuments, type SearchEntry } from '../lib/projectDocumentRank'

let entries: SearchEntry[] = []

self.onmessage = (
  event: MessageEvent<{ type: 'index'; entries: SearchEntry[] } | { type: 'search'; requestId: number; query: string }>,
) => {
  if (event.data.type === 'index') {
    entries = event.data.entries
    return
  }

  const { requestId, query } = event.data
  self.postMessage({ requestId, query, results: rankProjectDocuments(entries, query) })
}
