import { CACHE_CONFIG } from '@/constants/cache'
import { ICONIFY_SEARCH_CONFIG } from '@/constants/iconify'
import { SharedCache } from '@/services/cache.service'
import { requestManager } from '@/services/request.service'

const ICONIFY_SEARCH_ENDPOINT = 'https://api.iconify.design/search'
const ICONIFY_NAME_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*:[a-z0-9][a-z0-9_-]*$/
const ICONIFY_PREFIX_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

class IconifySearchRequestError extends Error {
  constructor(message: string, readonly retryable = false) {
    super(message)
    this.name = 'IconifySearchRequestError'
  }
}

export interface IconifyCollectionMetadata {
  name: string
}

export interface IconifySearchResult {
  icons: string[]
  total: number
  limit: number
  start: number
  collections: Record<string, IconifyCollectionMetadata>
}

export interface IconifySearchParams {
  query: string
  prefix?: string
  start?: number
  limit?: number
}

const searchCache = new SharedCache<IconifySearchResult>({
  maxSize: ICONIFY_SEARCH_CONFIG.cacheSize,
  ttl: ICONIFY_SEARCH_CONFIG.cacheTtl,
  cleanupInterval: CACHE_CONFIG.cleanup.interval,
})

function asRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null
}

function normalizeInteger(value: unknown, fallback: number, min: number, max: number): number {
  const parsed = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(parsed))
    return fallback
  return Math.min(Math.max(Math.floor(parsed), min), max)
}

function normalizeParams(params: IconifySearchParams): Required<IconifySearchParams> {
  const query = params.query.trim().slice(0, ICONIFY_SEARCH_CONFIG.maxQueryLength)
  if (query.length < ICONIFY_SEARCH_CONFIG.minQueryLength)
    throw new Error(`搜索词至少需要 ${ICONIFY_SEARCH_CONFIG.minQueryLength} 个字符`)

  const prefix = params.prefix?.trim().toLowerCase() ?? ''
  if (prefix && !ICONIFY_PREFIX_RE.test(prefix))
    throw new Error('图标集筛选条件无效')

  const start = normalizeInteger(params.start, 0, 0, ICONIFY_SEARCH_CONFIG.maxResults - 1)
  const requestedLimit = normalizeInteger(
    params.limit,
    start + ICONIFY_SEARCH_CONFIG.pageSize,
    32,
    ICONIFY_SEARCH_CONFIG.maxResults,
  )
  const limit = Math.max(requestedLimit, Math.min(start + ICONIFY_SEARCH_CONFIG.pageSize, ICONIFY_SEARCH_CONFIG.maxResults))

  return { query, prefix, start, limit }
}

function requestKey(params: Required<IconifySearchParams>): string {
  return [
    'iconify:search',
    params.query.toLowerCase(),
    params.prefix || 'all',
    params.start,
    params.limit,
  ].join(':')
}

export function abortIconifySearch(input: IconifySearchParams): void {
  try {
    requestManager.abort(requestKey(normalizeParams(input)))
  }
  catch {
    // Invalid or incomplete searches never reach the request manager.
  }
}

function parseSearchResult(value: unknown, params: Required<IconifySearchParams>): IconifySearchResult {
  const record = asRecord(value)
  if (!record)
    throw new IconifySearchRequestError('在线图标库返回了无效数据')

  const icons = Array.isArray(record.icons)
    ? [...new Set(record.icons.filter((icon): icon is string => typeof icon === 'string' && ICONIFY_NAME_RE.test(icon)))]
    : []
  const collectionsRecord = asRecord(record.collections)
  const collections: Record<string, IconifyCollectionMetadata> = {}

  if (collectionsRecord) {
    for (const [prefix, metadata] of Object.entries(collectionsRecord)) {
      const collection = asRecord(metadata)
      const name = typeof collection?.name === 'string' ? collection.name.trim().slice(0, 120) : ''
      if (ICONIFY_PREFIX_RE.test(prefix) && name)
        collections[prefix] = { name }
    }
  }

  const start = normalizeInteger(record.start, params.start, 0, ICONIFY_SEARCH_CONFIG.maxResults - 1)
  const limit = normalizeInteger(record.limit, params.limit, 32, ICONIFY_SEARCH_CONFIG.maxResults)
  const total = normalizeInteger(record.total, start + icons.length, start + icons.length, ICONIFY_SEARCH_CONFIG.maxResults)

  return { icons, total, limit, start, collections }
}

export async function searchIconifyIcons(input: IconifySearchParams): Promise<IconifySearchResult> {
  const params = normalizeParams(input)
  const key = requestKey(params)
  const cached = searchCache.get(key)
  if (cached)
    return cached

  try {
    const result = await requestManager.run(
      key,
      async (signal) => {
        const url = new URL(ICONIFY_SEARCH_ENDPOINT)
        url.searchParams.set('query', params.query)
        url.searchParams.set('start', String(params.start))
        url.searchParams.set('limit', String(params.limit))
        if (params.prefix)
          url.searchParams.set('prefix', params.prefix)

        const response = await fetch(url, {
          credentials: 'omit',
          headers: { Accept: 'application/json' },
          mode: 'cors',
          referrerPolicy: 'no-referrer',
          signal,
        })
        if (!response.ok) {
          if (response.status === 429)
            throw new IconifySearchRequestError('在线图标库请求繁忙，请稍后重试', true)
          if (response.status >= 400 && response.status < 500)
            throw new IconifySearchRequestError('图标搜索条件无效，请调整关键词')
          throw new IconifySearchRequestError('在线图标库暂时不可用', true)
        }

        return parseSearchResult(await response.json() as unknown, params)
      },
      {
        timeout: ICONIFY_SEARCH_CONFIG.timeout,
        retryAttempts: 1,
        shouldRetry: error => !(error instanceof IconifySearchRequestError) || error.retryable,
      },
    )
    return searchCache.set(key, result)
  }
  catch (error) {
    if (error instanceof IconifySearchRequestError)
      throw new Error(error.message)
    throw new Error('无法连接在线图标库，请稍后重试')
  }
}
