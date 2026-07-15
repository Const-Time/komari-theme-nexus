import type { NexusNodeHistory } from '@/types/nexus'
import { defineStore } from 'pinia'
import { reactive } from 'vue'
import { loadNodeLoadRecords } from '@/services/history.service'

const CACHE_TTL = 60 * 1000
const ERROR_RETRY_TTL = 15 * 1000
const HISTORY_HOURS = 6
const HISTORY_MAX_COUNT = 96

export const useNexusHistoryStore = defineStore('nexus-history', () => {
  const entries = reactive(new Map<string, NexusNodeHistory>())
  const pending = new Map<string, Promise<void>>()

  async function ensure(uuid: string): Promise<void> {
    const cached = entries.get(uuid)
    if (cached && Date.now() - cached.loadedAt < CACHE_TTL)
      return

    const inflight = pending.get(uuid)
    if (inflight)
      return inflight

    const request = (async () => {
      try {
        const loadRecords = await loadNodeLoadRecords(uuid, HISTORY_HOURS, HISTORY_MAX_COUNT)
        entries.set(uuid, {
          loadRecords,
          loadedAt: Date.now(),
          error: null,
        })
      }
      catch (error) {
        entries.set(uuid, {
          loadRecords: cached?.loadRecords ?? [],
          loadedAt: Date.now() - CACHE_TTL + ERROR_RETRY_TTL,
          error: error instanceof Error ? error.message : String(error),
        })
      }
      finally {
        pending.delete(uuid)
      }
    })()

    pending.set(uuid, request)
    return request
  }

  function get(uuid: string): NexusNodeHistory | undefined {
    return entries.get(uuid)
  }

  return { entries, ensure, get }
})
