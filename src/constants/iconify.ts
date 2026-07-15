import { TIME_MS } from '@/constants/time'

export const ICONIFY_SEARCH_CONFIG = {
  debounce: 300,
  timeout: 8 * TIME_MS.second,
  minQueryLength: 2,
  maxQueryLength: 80,
  pageSize: 64,
  maxResults: 256,
  cacheSize: 64,
  cacheTtl: 10 * TIME_MS.minute,
} as const

export const ICONIFY_COLLECTION_OPTIONS = [
  { value: '', label: '全部图标库' },
  { value: 'simple-icons', label: '品牌图标' },
  { value: 'tabler', label: 'Tabler' },
  { value: 'lucide', label: 'Lucide' },
  { value: 'mdi', label: 'Material Design' },
] as const

export const ICONIFY_POPULAR_SERVICE_ICONS = [
  'simple-icons:jellyfin',
  'simple-icons:plex',
  'simple-icons:docker',
  'simple-icons:homeassistant',
  'simple-icons:proxmox',
  'simple-icons:portainer',
  'simple-icons:qbittorrent',
  'simple-icons:immich',
  'simple-icons:nextcloud',
  'simple-icons:adguard',
  'simple-icons:nginxproxymanager',
  'tabler:server',
  'tabler:device-desktop',
  'tabler:database',
  'tabler:cloud',
  'tabler:router',
  'tabler:photo',
  'tabler:music',
  'tabler:movie',
  'tabler:download',
  'tabler:terminal-2',
  'tabler:shield-lock',
  'tabler:home',
  'lucide:server',
  'lucide:house',
  'lucide:database',
  'lucide:cloud',
  'mdi:server',
  'mdi:home',
  'mdi:database',
  'mdi:cloud',
] as const
