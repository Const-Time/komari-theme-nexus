import type { NexusConfig, NexusNetworkMode, NexusService, NexusSettingsSnapshot } from '@/types/nexus'
import { useStorage } from '@vueuse/core'
import { defineStore } from 'pinia'
import { computed, watch } from 'vue'
import { useAppStore } from '@/stores/app'
import { getSharedApi } from '@/utils/api'
import {
  parseNexusConfig,
  resolveAutomaticNetworkMode,
  resolveServiceUrl,
  serializeNexusConfig,
  validateHostPatterns,
} from '@/utils/nexusConfig'

const DEFAULT_PROBE_INTERVAL = 8

function readBoolean(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback
}

function readInterval(value: unknown): number {
  const parsed = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(parsed))
    return DEFAULT_PROBE_INTERVAL
  return Math.min(Math.max(Math.round(parsed), 3), 60)
}

export const useNexusStore = defineStore('nexus', () => {
  const appStore = useAppStore()
  const api = getSharedApi()

  const networkMode = useStorage<NexusNetworkMode>('komari-nexus:network-mode', 'auto')
  const probeAutoplayPreference = useStorage<'default' | 'enabled' | 'disabled'>('komari-nexus:probe-autoplay', 'default')
  const selectedServiceGroup = useStorage<string>('komari-nexus:service-group', 'all')
  const probePage = useStorage<number>('komari-nexus:probe-page', 0)

  const currentThemeSettings = computed<Record<string, unknown>>(() => {
    const value = appStore.publicSettings?.theme_settings
    return value && typeof value === 'object' ? value : {}
  })

  const config = computed<NexusConfig>(() => appStore.nexusConfig)
  const groups = computed(() => [...config.value.groups]
    .filter(group => group.enabled)
    .sort((a, b) => a.order - b.order || a.name.localeCompare(b.name)))
  const activeGroupIds = computed(() => new Set(groups.value.map(group => group.id)))
  const services = computed(() => [...config.value.services]
    .filter(service => service.enabled && (!service.groupId || activeGroupIds.value.has(service.groupId)))
    .sort((a, b) => a.order - b.order || a.name.localeCompare(b.name)))
  const featuredServices = computed(() => services.value.filter(service => service.featured))

  const lanHostPatterns = computed(() => appStore.nexusLanHostPatterns)
  const wanHostPatterns = computed(() => appStore.nexusWanHostPatterns)

  const automaticNetworkMode = computed<'lan' | 'wan'>(() => {
    const hostname = typeof window === 'undefined' ? '' : window.location.hostname
    return resolveAutomaticNetworkMode(hostname, lanHostPatterns.value, wanHostPatterns.value)
  })
  const effectiveNetworkMode = computed<'lan' | 'wan'>(() =>
    networkMode.value === 'auto' ? automaticNetworkMode.value : networkMode.value,
  )

  const managedProbeAutoplay = computed(() => readBoolean(appStore.nexusProbeAutoplay, true))
  const probeAutoplay = computed({
    get: () => probeAutoplayPreference.value === 'default'
      ? managedProbeAutoplay.value
      : probeAutoplayPreference.value === 'enabled',
    set: (enabled: boolean) => {
      probeAutoplayPreference.value = enabled ? 'enabled' : 'disabled'
    },
  })
  const probeInterval = computed(() => readInterval(appStore.nexusProbeInterval))

  watch(networkMode, (mode) => {
    if (mode !== 'auto' && mode !== 'lan' && mode !== 'wan')
      networkMode.value = 'auto'
  }, { immediate: true })

  function serviceUrl(service: NexusService): string {
    return resolveServiceUrl(service, effectiveNetworkMode.value)
  }

  function servicesForNode(nodeUuid: string): NexusService[] {
    return services.value.filter(service => service.nodeUuid === nodeUuid)
  }

  function updatePublicThemeSettings(nextSettings: Record<string, unknown>) {
    if (!appStore.publicSettings)
      return
    appStore.publicSettings = {
      ...appStore.publicSettings,
      theme_settings: nextSettings,
    }
  }

  async function saveSettings(snapshot: NexusSettingsSnapshot): Promise<void> {
    if (!await appStore.requireLoginPermission('nexusSettings', { force: true }))
      throw new Error('请先登录 Komari 后台再保存 Nexus 设置')

    const theme = appStore.publicSettings?.theme || 'nexus'
    const nextSettings: Record<string, unknown> = {
      ...currentThemeSettings.value,
      nexusConfig: serializeNexusConfig(snapshot.config),
      nexusLanHostPatterns: validateHostPatterns(snapshot.lanHostPatterns).join(','),
      nexusWanHostPatterns: validateHostPatterns(snapshot.wanHostPatterns).join(','),
      nexusProbeAutoplay: snapshot.probeAutoplay,
      nexusProbeInterval: readInterval(snapshot.probeInterval),
    }

    await api.updateThemeSettings(theme, nextSettings)
    updatePublicThemeSettings(nextSettings)
    probeAutoplayPreference.value = 'default'
  }

  async function saveServiceIcon(serviceId: string, icon: string): Promise<boolean> {
    if (!await appStore.requireLoginPermission('nexusSettings', { force: true }))
      throw new Error('请先登录 Komari 后台再保存图标')

    const nextConfig = parseNexusConfig(config.value)
    const service = nextConfig.services.find(item => item.id === serviceId)
    if (!service)
      return false

    service.icon = icon
    const theme = appStore.publicSettings?.theme || 'nexus'
    const nextSettings: Record<string, unknown> = {
      ...currentThemeSettings.value,
      nexusConfig: serializeNexusConfig(nextConfig),
    }

    await api.updateThemeSettings(theme, nextSettings)
    updatePublicThemeSettings(nextSettings)
    return true
  }

  return {
    networkMode,
    automaticNetworkMode,
    effectiveNetworkMode,
    selectedServiceGroup,
    probePage,
    config,
    groups,
    services,
    featuredServices,
    lanHostPatterns,
    wanHostPatterns,
    probeAutoplay,
    probeInterval,
    serviceUrl,
    servicesForNode,
    saveSettings,
    saveServiceIcon,
  }
})
