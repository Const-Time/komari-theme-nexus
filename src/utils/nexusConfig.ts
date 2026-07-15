import type {
  NexusConfig,
  NexusNetworkMode,
  NexusService,
  NexusServiceGroup,
} from '@/types/nexus'

const HOST_PATTERN_SEPARATOR_RE = /[\n,]/
const REGEXP_SPECIAL_CHARS_RE = /[.+?^${}()|[\]\\]/g

export const NEXUS_CONFIG_VERSION = 1 as const
export const NEXUS_MAX_GROUPS = 32
export const NEXUS_MAX_SERVICES = 64
export const NEXUS_MAX_CONFIG_BYTES = 512 * 1024
export const NEXUS_MAX_HOST_PATTERNS = 128
export const NEXUS_MAX_HOST_PATTERN_LENGTH = 253

const MAX_ID_LENGTH = 128
const MAX_GROUP_NAME_LENGTH = 80
const MAX_SERVICE_NAME_LENGTH = 120
const MAX_DESCRIPTION_LENGTH = 300
const MAX_ICON_LENGTH = 32 * 1024
const MAX_URL_LENGTH = 2048

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
  if (!id || id === 'all' || id.length > MAX_ID_LENGTH || !name || name.length > MAX_GROUP_NAME_LENGTH)
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
  if (!id || id.length > MAX_ID_LENGTH || !name || name.length > MAX_SERVICE_NAME_LENGTH)
    return null

  const description = readString(record.description)
  const icon = readString(record.icon)
  const groupId = readString(record.groupId)
  const nodeUuid = readString(record.nodeUuid)
  const lanUrl = readString(record.lanUrl)
  const wanUrl = readString(record.wanUrl)
  if (description.length > MAX_DESCRIPTION_LENGTH
    || icon.length > MAX_ICON_LENGTH
    || groupId.length > MAX_ID_LENGTH
    || nodeUuid.length > MAX_ID_LENGTH
    || lanUrl.length > MAX_URL_LENGTH
    || wanUrl.length > MAX_URL_LENGTH) {
    return null
  }

  return {
    id,
    name,
    description,
    icon,
    groupId,
    nodeUuid,
    lanUrl,
    wanUrl,
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

function assertWritableConfig(config: NexusConfig): void {
  if (config.groups.length > NEXUS_MAX_GROUPS)
    throw new Error(`服务分组不能超过 ${NEXUS_MAX_GROUPS} 个`)
  if (config.services.length > NEXUS_MAX_SERVICES)
    throw new Error(`服务不能超过 ${NEXUS_MAX_SERVICES} 个`)

  const groupIds = new Set<string>()
  for (const group of config.groups) {
    const id = group.id.trim()
    if (!id || id === 'all' || id.length > MAX_ID_LENGTH || groupIds.has(id))
      throw new Error('服务分组 ID 无效或重复')
    if (!group.name.trim() || group.name.trim().length > MAX_GROUP_NAME_LENGTH)
      throw new Error(`服务分组名称不能为空且不能超过 ${MAX_GROUP_NAME_LENGTH} 个字符`)
    groupIds.add(id)
  }

  const serviceIds = new Set<string>()
  for (const service of config.services) {
    const id = service.id.trim()
    if (!id || id.length > MAX_ID_LENGTH || serviceIds.has(id))
      throw new Error('服务 ID 无效或重复')
    if (!service.name.trim() || service.name.trim().length > MAX_SERVICE_NAME_LENGTH)
      throw new Error(`服务名称不能为空且不能超过 ${MAX_SERVICE_NAME_LENGTH} 个字符`)
    if (service.description.length > MAX_DESCRIPTION_LENGTH)
      throw new Error(`服务说明不能超过 ${MAX_DESCRIPTION_LENGTH} 个字符`)
    if (service.icon.length > MAX_ICON_LENGTH)
      throw new Error('服务图标数据过大，请重新上传或改用 Iconify/图片地址')
    if (service.groupId.trim().length > MAX_ID_LENGTH || service.nodeUuid.trim().length > MAX_ID_LENGTH)
      throw new Error('服务分组或节点标识过长')
    if (service.lanUrl.length > MAX_URL_LENGTH || service.wanUrl.length > MAX_URL_LENGTH)
      throw new Error(`服务地址不能超过 ${MAX_URL_LENGTH} 个字符`)
    if ((service.lanUrl.trim() && !sanitizeServiceUrl(service.lanUrl))
      || (service.wanUrl.trim() && !sanitizeServiceUrl(service.wanUrl))) {
      throw new Error('服务地址必须是完整的 HTTP 或 HTTPS URL')
    }
    if (service.groupId.trim() && !groupIds.has(service.groupId.trim()))
      throw new Error(`${service.name.trim()} 绑定了不存在的服务分组`)
    serviceIds.add(id)
  }
}

export function parseNexusConfig(value: unknown): NexusConfig {
  try {
    if (typeof value === 'string' && new TextEncoder().encode(value).byteLength > NEXUS_MAX_CONFIG_BYTES)
      return structuredClone(EMPTY_NEXUS_CONFIG)

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
    const groupIds = new Set(groups.map(group => group.id))
    services.forEach((service) => {
      if (service.groupId && !groupIds.has(service.groupId))
        service.groupId = ''
    })

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
  assertWritableConfig(config)
  const normalized = parseNexusConfig(config)
  const serialized = JSON.stringify(normalized)
  if (new TextEncoder().encode(serialized).byteLength > NEXUS_MAX_CONFIG_BYTES)
    throw new Error('服务配置超过 512 KB，请减少内嵌图标或改用 Iconify/图片地址')
  return serialized
}

export function parseHostPatterns(value: unknown, fallback: string[] = []): string[] {
  const source = Array.isArray(value)
    ? value
    : typeof value === 'string'
      ? value.split(HOST_PATTERN_SEPARATOR_RE)
      : fallback

  return [...new Set(source
    .map(item => readString(item).toLowerCase())
    .filter(pattern => Boolean(pattern) && pattern.length <= NEXUS_MAX_HOST_PATTERN_LENGTH))]
    .slice(0, NEXUS_MAX_HOST_PATTERNS)
}

export function validateHostPatterns(value: unknown): string[] {
  const source = Array.isArray(value)
    ? value
    : typeof value === 'string'
      ? value.split(HOST_PATTERN_SEPARATOR_RE)
      : []
  const patterns = source.map(item => readString(item).toLowerCase()).filter(Boolean)

  if (patterns.length > NEXUS_MAX_HOST_PATTERNS)
    throw new Error(`主机匹配规则不能超过 ${NEXUS_MAX_HOST_PATTERNS} 条`)
  if (patterns.some(pattern => pattern.length > NEXUS_MAX_HOST_PATTERN_LENGTH))
    throw new Error(`单条主机匹配规则不能超过 ${NEXUS_MAX_HOST_PATTERN_LENGTH} 个字符`)

  return [...new Set(patterns)]
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
    const parsed = new URL(url)
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
