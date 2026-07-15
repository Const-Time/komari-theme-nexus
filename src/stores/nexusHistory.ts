import type { NexusNodeHistory, NexusPingRecord, NexusPingTask } from '@/types/nexus'
import type { LoadRecord, PingRecordsResponse } from '@/utils/api'
import { defineStore } from 'pinia'
import { reactive } from 'vue'
import { getSharedApi } from '@/utils/api'
import { getSharedRpc } from '@/utils/rpc'

interface LoadResponse {
  records?: LoadRecord[]
}

interface PingResponse {
  records?: NexusPingRecord[]
  tasks?: NexusPingTask[]
}

const CACHE_TTL = 5 * 60 * 1000
const HISTORY_HOURS = 6
const HISTORY_MAX_COUNT = 96

function sortByTime<T extends { time: string }>(records: T[]): T[] {
  return [...records].sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime())
}

export const useNexusHistoryStore = defineStore('nexus-history', () => {
  const entries = reactive(new Map<string, NexusNodeHistory>())
  const pending = new Map<string, Promise<void>>()

  async function fetchLoadRecords(uuid: string): Promise<LoadRecord[]> {
    try {
      const result = await getSharedRpc().getClient().call<LoadResponse>('common:getRecords', {
        uuid,
        type: 'load',
        hours: HISTORY_HOURS,
        max_count: HISTORY_MAX_COUNT,
      })
      return sortByTime(result?.records || [])
    }
    catch {
      const result = await getSharedApi().getLoadRecords(uuid, HISTORY_HOURS)
      return sortByTime(result.records || [])
    }
  }

  async function fetchPingRecords(uuid: string): Promise<PingResponse> {
    try {
      const result = await getSharedRpc().getClient().call<PingResponse>('common:getRecords', {
        uuid,
        type: 'ping',
        hours: HISTORY_HOURS,
        max_count: HISTORY_MAX_COUNT,
      })
      return {
        records: sortByTime(result?.records || []),
        tasks: result?.tasks || [],
      }
    }
    catch {
      const result: PingRecordsResponse = await getSharedApi().getPingRecords(uuid, HISTORY_HOURS)
      return {
        records: sortByTime(result.records || []),
        tasks: result.tasks || [],
      }
    }
  }

  async function ensure(uuid: string): Promise<void> {
    const cached = entries.get(uuid)
    if (cached && Date.now() - cached.loadedAt < CACHE_TTL)
      return

    const inflight = pending.get(uuid)
    if (inflight)
      return inflight

    const request = (async () => {
      try {
        const [loadResult, pingResult] = await Promise.allSettled([
          fetchLoadRecords(uuid),
          fetchPingRecords(uuid),
        ])
        const loadRecords = loadResult.status === 'fulfilled' ? loadResult.value : []
        const ping = pingResult.status === 'fulfilled' ? pingResult.value : { records: [], tasks: [] }
        const errors = [loadResult, pingResult]
          .filter(result => result.status === 'rejected')
          .map(result => result.reason instanceof Error ? result.reason.message : String(result.reason))

        entries.set(uuid, {
          loadRecords,
          pingRecords: ping.records || [],
          pingTasks: ping.tasks || [],
          loadedAt: Date.now(),
          error: errors.length > 0 ? errors.join('; ') : null,
        })
      }
      finally {
        pending.delete(uuid)
      }
    })()

    pending.set(uuid, request)
    return request
  }

  async function ensureMany(uuids: string[]): Promise<void> {
    await Promise.all(uuids.map(ensure))
  }

  function get(uuid: string): NexusNodeHistory | undefined {
    return entries.get(uuid)
  }

  return { entries, ensure, ensureMany, get }
})
