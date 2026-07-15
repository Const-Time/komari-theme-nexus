import type { LoadRecord, PingRecord, PingTask } from '@/utils/api'

export type NexusNetworkMode = 'auto' | 'lan' | 'wan'

export interface NexusServiceGroup {
  id: string
  name: string
  order: number
  enabled: boolean
}

export interface NexusService {
  id: string
  name: string
  description: string
  icon: string
  groupId: string
  nodeUuid: string
  lanUrl: string
  wanUrl: string
  featured: boolean
  enabled: boolean
  order: number
}

export interface NexusConfig {
  version: 1
  groups: NexusServiceGroup[]
  services: NexusService[]
}

export interface NexusSettingsSnapshot {
  config: NexusConfig
  lanHostPatterns: string[]
  wanHostPatterns: string[]
  probeAutoplay: boolean
  probeInterval: number
}

export interface NexusPingRecord extends PingRecord {
  client?: string
}

export interface NexusPingTask extends PingTask {
  latest?: number
  avg?: number
}

export interface NexusNodeHistory {
  loadRecords: LoadRecord[]
  pingRecords: NexusPingRecord[]
  pingTasks: NexusPingTask[]
  loadedAt: number
  error: string | null
}

export interface NexusAggregateSample {
  timestamp: number
  online: number
  cpu: number
  memory: number
  disk: number
  upload: number
  download: number
}
