import type {
  NexusConfig,
  NexusNetworkMode,
  NexusService,
  NexusServiceGroup,
} from '@/types/nexus'

const HOST_PATTERN_SEPARATOR_RE = /[\n,]/
const REGEXP_SPECIAL_CHARS_RE = /[.+?^${}()|[\]\\]/g

export const NEXUS_CONFIG_VERSION = 1 as const

export const DEFAULT_LAN_HOST_PATTERNS = [
  'localhost',
  '127.0.0.1',
  '*.local',
  '10.*',
  '192.168.*',
  '172.16.*',
  '172.17.*',
  '172.18.*',
  '172.19.*',
  '172.20.*',
  '172.21.*',
  '172.22.*',
  '172.23.*',
  '172.24.*',
  '172.25.*',
  '172.26.*',
  '172.27.*',
  '172.28.*',
  '172.29.*',
  '172.30.*',
  '172.31.*',
]

export const EMPTY_NEXUS_CONFIG: NexusConfig = {
  version: NEXUS_CONFIG_VERSION,
  groups: [],
  services: [],
}

function asObject(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null
}

function readString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function readBoolean(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback
}

function readOrder(value: unknown, fallback: number): number {
  const parsed = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

function parseGroup(value: unknown, index: number): NexusServiceGroup | null {
  const record = asObject(value)
  if (!record)
    return null

  const id = readString(record.id)
  const name = readString(record.name)
  if (!id || !name)
    return null

  return {
    id,
    name,
    order: readOrder(record.order, index),
    enabled: readBoolean(record.enabled, true),
  }
}

function parseService(value: unknown, index: number): NexusService | null {
  const record = asObject(value)
  if (!record)
    return null

  const id = readString(record.id)
  const name = readString(record.name)
  if (!id || !name)
    return null

  return {
    id,
    name,
    description: readString(record.description),
    icon: readString(record.icon),
    groupId: readString(record.groupId),
    nodeUuid: readString(record.nodeUuid),
    lanUrl: readString(record.lanUrl),
    wanUrl: readString(record.wanUrl),
    featured: readBoolean(record.featured, false),
    enabled: readBoolean(record.enabled, true),
    order: readOrder(record.order, index),
  }
}

function uniqueById<T extends { id: string }>(items: T[]): T[] {
  const seen = new Set<string>()
  return items.filter((item) => {
    if (seen.has(item.id))
      return false
    seen.add(item.id)
    return true
  })
}

export function parseNexusConfig(value: unknown): NexusConfig {
  try {
    const parsed = typeof value === 'string' ? JSON.parse(value) as unknown : value
    const record = asObject(parsed)
    if (!record)
      return structuredClone(EMPTY_NEXUS_CONFIG)

    const groups = Array.isArray(record.groups)
      ? uniqueById(record.groups.map(parseGroup).filter((item): item is NexusServiceGroup => item !== null))
      : []
    const services = Array.isArray(record.services)
      ? uniqueById(record.services.map(parseService).filter((item): item is NexusService => item !== null))
      : []

    return {
      version: NEXUS_CONFIG_VERSION,
      groups,
      services,
    }
  }
  catch {
    return structuredClone(EMPTY_NEXUS_CONFIG)
  }
}

export function serializeNexusConfig(config: NexusConfig): string {
  return JSON.stringify(parseNexusConfig(config))
}

export function parseHostPatterns(value: unknown, fallback: string[] = []): string[] {
  const source = Array.isArray(value)
    ? value
    : typeof value === 'string'
      ? value.split(HOST_PATTERN_SEPARATOR_RE)
      : fallback

  return [...new Set(source
    .map(item => readString(item).toLowerCase())
    .filter(Boolean))]
}

function wildcardPatternToRegExp(pattern: string): RegExp {
  const escaped = pattern.replace(REGEXP_SPECIAL_CHARS_RE, '\\$&').replaceAll('*', '.*')
  // The expression is dynamic because each managed host pattern is user-configurable.

  return new RegExp(`^${escaped}$`, 'i')
}

export function matchesHostPattern(hostname: string, pattern: string): boolean {
  if (!hostname || !pattern)
    return false
  return wildcardPatternToRegExp(pattern).test(hostname)
}

export function resolveAutomaticNetworkMode(
  hostname: string,
  lanPatterns: string[],
  wanPatterns: string[],
): Exclude<NexusNetworkMode, 'auto'> {
  const normalizedHostname = hostname.trim().toLowerCase()
  if (wanPatterns.some(pattern => matchesHostPattern(normalizedHostname, pattern)))
    return 'wan'
  if (lanPatterns.some(pattern => matchesHostPattern(normalizedHostname, pattern)))
    return 'lan'
  return 'wan'
}

export function resolveServiceUrl(
  service: Pick<NexusService, 'lanUrl' | 'wanUrl'>,
  mode: Exclude<NexusNetworkMode, 'auto'>,
): string {
  const preferred = sanitizeServiceUrl(mode === 'lan' ? service.lanUrl : service.wanUrl)
  const fallback = sanitizeServiceUrl(mode === 'lan' ? service.wanUrl : service.lanUrl)
  return preferred || fallback || ''
}

function sanitizeServiceUrl(value: string): string {
  const url = value.trim()
  if (!url)
    return ''

  try {
    const parsed = new URL(url, 'http://localhost')
    return parsed.protocol === 'http:' || parsed.protocol === 'https:' ? url : ''
  }
  catch {
    return ''
  }
}

export function createNexusId(prefix: 'group' | 'service'): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto)
    return `${prefix}-${crypto.randomUUID()}`
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}
