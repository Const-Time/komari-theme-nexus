import type { IconifyCollectionMetadata } from '@/services/iconify.service'
import { computed, onScopeDispose, ref, watch } from 'vue'
import { ICONIFY_SEARCH_CONFIG } from '@/constants/iconify'
import { abortIconifySearch, searchIconifyIcons } from '@/services/iconify.service'

export function useIconifySearch() {
  const query = ref('')
  const prefix = ref('')
  const icons = ref<string[]>([])
  const collections = ref<Record<string, IconifyCollectionMetadata>>({})
  const loading = ref(false)
  const loadingMore = ref(false)
  const error = ref('')
  const hasMore = ref(false)
  const nextStart = ref(0)
  let revision = 0
  let debounceTimer: ReturnType<typeof setTimeout> | null = null
  let activeRequest: { query: string, prefix: string, start: number, limit: number } | null = null

  const normalizedQuery = computed(() => query.value.trim())
  const canSearch = computed(() => normalizedQuery.value.length >= ICONIFY_SEARCH_CONFIG.minQueryLength)

  function clearDebounce() {
    if (debounceTimer) {
      clearTimeout(debounceTimer)
      debounceTimer = null
    }
  }

  function clearResults() {
    icons.value = []
    collections.value = {}
    error.value = ''
    hasMore.value = false
    nextStart.value = 0
  }

  function abortActiveRequest() {
    if (!activeRequest)
      return
    abortIconifySearch(activeRequest)
    activeRequest = null
  }

  async function runPage(reset: boolean, requestRevision: number): Promise<void> {
    if (!canSearch.value)
      return

    const start = reset ? 0 : nextStart.value
    const limit = Math.min(start + ICONIFY_SEARCH_CONFIG.pageSize, ICONIFY_SEARCH_CONFIG.maxResults)
    const querySnapshot = normalizedQuery.value
    const prefixSnapshot = prefix.value

    if (reset)
      loading.value = true
    else
      loadingMore.value = true
    error.value = ''

    const request = {
      query: querySnapshot,
      prefix: prefixSnapshot,
      start,
      limit,
    }
    activeRequest = request

    try {
      const result = await searchIconifyIcons(request)
      if (requestRevision !== revision)
        return

      icons.value = reset
        ? result.icons
        : [...new Set([...icons.value, ...result.icons])]
      collections.value = reset
        ? result.collections
        : { ...collections.value, ...result.collections }
      nextStart.value = result.start + result.icons.length
      hasMore.value = result.icons.length > 0
        && result.total === result.limit
        && nextStart.value < ICONIFY_SEARCH_CONFIG.maxResults
    }
    catch (searchError) {
      if (requestRevision !== revision)
        return
      error.value = searchError instanceof Error ? searchError.message : '在线图标搜索失败'
      if (reset) {
        icons.value = []
        collections.value = {}
        hasMore.value = false
        nextStart.value = 0
      }
    }
    finally {
      if (activeRequest === request)
        activeRequest = null
      if (requestRevision === revision) {
        loading.value = false
        loadingMore.value = false
      }
    }
  }

  function scheduleSearch() {
    clearDebounce()
    abortActiveRequest()
    revision += 1
    loading.value = false
    loadingMore.value = false
    clearResults()

    if (!canSearch.value)
      return

    loading.value = true
    const requestRevision = revision
    debounceTimer = setTimeout(() => {
      debounceTimer = null
      void runPage(true, requestRevision)
    }, ICONIFY_SEARCH_CONFIG.debounce)
  }

  async function searchNow(): Promise<void> {
    clearDebounce()
    if (activeRequest
      && activeRequest.start === 0
      && activeRequest.query === normalizedQuery.value
      && activeRequest.prefix === prefix.value) {
      return
    }
    abortActiveRequest()
    revision += 1
    clearResults()
    await runPage(true, revision)
  }

  async function loadMore(): Promise<void> {
    if (!hasMore.value || loading.value || loadingMore.value)
      return
    await runPage(false, revision)
  }

  function resetSearch() {
    clearDebounce()
    abortActiveRequest()
    revision += 1
    query.value = ''
    prefix.value = ''
    loading.value = false
    loadingMore.value = false
    clearResults()
  }

  watch([query, prefix], scheduleSearch)

  onScopeDispose(() => {
    clearDebounce()
    abortActiveRequest()
    revision += 1
  })

  return {
    query,
    prefix,
    icons,
    collections,
    loading,
    loadingMore,
    error,
    hasMore,
    normalizedQuery,
    canSearch,
    searchNow,
    loadMore,
    resetSearch,
  }
}
