import type { NexusService } from '@/types/nexus'

const ICON_LOAD_TIMEOUT = 4_000
const PAGE_FETCH_TIMEOUT = 4_000
const MAX_ICON_LINKS = 8
const MAX_UPLOAD_BYTES = 2 * 1024 * 1024
const MAX_STORED_ICON_BYTES = 16 * 1024
const SVG_NAMESPACE = 'http://www.w3.org/2000/svg'
const ICON_FILE_RE = /\.(?:avif|gif|ico|jpe?g|png|svg|webp)(?:$|[?#])/i
const REL_SEPARATOR_RE = /\s+/
const SVG_DOCUMENT_DECLARATION_RE = /<!doctype|<!entity/i
const SVG_EVENT_ATTRIBUTE_RE = /^on/i
const SVG_STYLE_WHITESPACE_RE = /\s+/g
const SVG_SAFE_DATA_IMAGE_RE = /^data:image\/(?:gif|jpeg|png|webp);base64,/i
const SVG_FORBIDDEN_ELEMENTS = 'script, foreignObject, foreignobject, iframe, object, embed, audio, video'
const ALLOWED_UPLOAD_TYPES = new Set([
  'image/gif',
  'image/jpeg',
  'image/png',
  'image/svg+xml',
  'image/vnd.microsoft.icon',
  'image/webp',
  'image/x-icon',
])
const ALLOWED_UPLOAD_EXTENSIONS = new Set(['gif', 'ico', 'jpeg', 'jpg', 'png', 'svg', 'webp'])

interface DecodedImage {
  source: CanvasImageSource
  width: number
  height: number
  dispose: () => void
}

function parseHttpUrl(value: string): URL | null {
  try {
    const url = new URL(value.trim())
    if (url.protocol !== 'http:' && url.protocol !== 'https:')
      return null
    url.username = ''
    url.password = ''
    url.hash = ''
    return url
  }
  catch {
    return null
  }
}

function uniqueUrls(urls: string[]): string[] {
  return [...new Set(urls.filter(Boolean))]
}

function cacheBustedUrl(url: URL): string {
  const refreshed = new URL(url)
  refreshed.searchParams.set('_nexus_icon', Date.now().toString(36))
  return refreshed.href
}

function canLoadImage(url: string): Promise<boolean> {
  return new Promise((resolve) => {
    const image = new Image()
    let settled = false
    let timer = 0
    const finish = (result: boolean) => {
      if (settled)
        return
      settled = true
      window.clearTimeout(timer)
      image.onload = null
      image.onerror = null
      resolve(result)
    }
    timer = window.setTimeout(finish, ICON_LOAD_TIMEOUT, false)

    image.decoding = 'async'
    image.referrerPolicy = 'no-referrer'
    image.onload = () => finish(image.naturalWidth > 0 && image.naturalHeight > 0)
    image.onerror = () => finish(false)
    image.src = url
  })
}

async function firstLoadableImage(urls: string[]): Promise<string | null> {
  const candidates = uniqueUrls(urls)
  if (candidates.length === 0)
    return null

  return new Promise((resolve) => {
    let pending = candidates.length
    let settled = false
    candidates.forEach(async (url) => {
      const loaded = await canLoadImage(url)
      pending -= 1
      if (settled)
        return
      if (loaded) {
        settled = true
        resolve(url)
      }
      else if (pending === 0) {
        settled = true
        resolve(null)
      }
    })
  })
}

async function discoverLinkedIcons(pageUrl: URL): Promise<string[]> {
  const controller = new AbortController()
  const timer = window.setTimeout(() => controller.abort(), PAGE_FETCH_TIMEOUT)

  try {
    const response = await fetch(pageUrl.href, {
      credentials: 'omit',
      headers: { Accept: 'text/html,application/xhtml+xml' },
      mode: 'cors',
      signal: controller.signal,
    })
    if (!response.ok)
      return []

    const contentLength = Number(response.headers.get('content-length') || 0)
    if (contentLength > 1024 * 1024)
      return []

    const html = await response.text()
    const document = new DOMParser().parseFromString(html.slice(0, 1024 * 1024), 'text/html')
    const links = [...document.querySelectorAll<HTMLLinkElement>('link[rel][href]')]
      .filter((link) => {
        const rel = link.rel.toLowerCase().split(REL_SEPARATOR_RE)
        return rel.includes('icon')
          || rel.includes('apple-touch-icon')
          || rel.includes('apple-touch-icon-precomposed')
          || rel.includes('mask-icon')
      })
      .map((link) => {
        const resolved = parseHttpUrl(new URL(link.getAttribute('href')!, pageUrl).href)
        return resolved?.href ?? ''
      })

    return uniqueUrls(links).slice(0, MAX_ICON_LINKS)
  }
  catch {
    return []
  }
  finally {
    window.clearTimeout(timer)
  }
}

async function findIconForUrl(pageUrl: URL): Promise<string | null> {
  const directCandidate = ICON_FILE_RE.test(pageUrl.href) ? pageUrl.href : ''
  const faviconUrl = new URL('/favicon.ico', pageUrl)
  const commonIcon = await firstLoadableImage([
    directCandidate,
    cacheBustedUrl(faviconUrl),
    faviconUrl.href,
    new URL('/favicon.svg', pageUrl).href,
    new URL('/favicon.png', pageUrl).href,
    new URL('/apple-touch-icon.png', pageUrl).href,
  ])
  if (commonIcon)
    return commonIcon

  return firstLoadableImage(await discoverLinkedIcons(pageUrl))
}

function firstDiscoveredIcon(urls: URL[]): Promise<string | null> {
  return new Promise((resolve) => {
    let pending = urls.length
    let settled = false
    urls.forEach(async (url) => {
      const icon = await findIconForUrl(url)
      pending -= 1
      if (settled)
        return
      if (icon) {
        settled = true
        resolve(icon)
      }
      else if (pending === 0) {
        settled = true
        resolve(null)
      }
    })
  })
}

export async function discoverServiceIcon(
  service: Pick<NexusService, 'lanUrl' | 'wanUrl'>,
  preferredUrl = '',
): Promise<string> {
  const urls = uniqueUrls([preferredUrl, service.wanUrl, service.lanUrl])
    .map(parseHttpUrl)
    .filter((url): url is URL => url !== null)

  if (urls.length === 0)
    throw new Error('请先填写可用的内网地址或外网地址')

  const icon = await firstDiscoveredIcon(urls)
  if (!icon)
    throw new Error('未找到可用的站点图标，请改用上传图标')
  return icon
}

function validateUpload(file: File) {
  if (file.size > MAX_UPLOAD_BYTES)
    throw new Error('图标文件不能超过 2 MB')

  const extension = file.name.split('.').pop()?.toLowerCase() ?? ''
  if (!ALLOWED_UPLOAD_TYPES.has(file.type) && !ALLOWED_UPLOAD_EXTENSIONS.has(extension))
    throw new Error('仅支持 SVG、PNG、JPG、WebP、GIF 或 ICO 图片')
}

function isSvgUpload(file: File): boolean {
  return file.type === 'image/svg+xml' || file.name.toLowerCase().endsWith('.svg')
}

function hasUnsafeSvgStyle(value: string): boolean {
  const style = value.replace(SVG_STYLE_WHITESPACE_RE, '').toLowerCase()
  if (style.includes('@import') || style.includes('expression(') || style.includes('javascript:'))
    return true

  let cursor = 0
  while (cursor < style.length) {
    const start = style.indexOf('url(', cursor)
    if (start < 0)
      return false
    const end = style.indexOf(')', start + 4)
    if (end < 0)
      return true

    let reference = style.slice(start + 4, end)
    const quote = reference[0]
    if ((quote === '"' || quote === '\'') && reference.at(-1) === quote)
      reference = reference.slice(1, -1)
    if (!reference.startsWith('#'))
      return true
    cursor = end + 1
  }
  return false
}

function isSafeSvgReference(value: string): boolean {
  const reference = value.trim()
  return reference.startsWith('#') || SVG_SAFE_DATA_IMAGE_RE.test(reference)
}

async function sanitizeSvgUpload(file: File): Promise<Blob> {
  const source = await file.text()
  if (SVG_DOCUMENT_DECLARATION_RE.test(source))
    throw new Error('SVG 不能包含 DOCTYPE 或实体声明')

  const document = new DOMParser().parseFromString(source, 'image/svg+xml')
  const root = document.documentElement
  if (root.localName !== 'svg' || document.querySelector('parsererror'))
    throw new Error('SVG 文件格式无效')

  root.setAttribute('xmlns', SVG_NAMESPACE)
  root.querySelectorAll(SVG_FORBIDDEN_ELEMENTS).forEach(element => element.remove())

  for (const element of [root, ...root.querySelectorAll('*')]) {
    if (element.localName === 'style' && hasUnsafeSvgStyle(element.textContent || '')) {
      element.remove()
      continue
    }

    for (const attribute of [...element.attributes]) {
      const name = attribute.name.toLowerCase()
      const value = attribute.value
      if (SVG_EVENT_ATTRIBUTE_RE.test(name)
        || value.toLowerCase().includes('javascript:')
        || (name === 'style' && hasUnsafeSvgStyle(value))
        || ((name === 'href' || name === 'xlink:href') && !isSafeSvgReference(value))) {
        element.removeAttribute(attribute.name)
      }
    }
  }

  return new Blob([new XMLSerializer().serializeToString(root)], { type: 'image/svg+xml' })
}

async function decodeImage(file: Blob): Promise<DecodedImage> {
  if ('createImageBitmap' in window) {
    try {
      const bitmap = await createImageBitmap(file)
      return {
        source: bitmap,
        width: bitmap.width,
        height: bitmap.height,
        dispose: () => bitmap.close(),
      }
    }
    catch {
      // Fall through for formats the browser cannot decode with createImageBitmap.
    }
  }

  const objectUrl = URL.createObjectURL(file)
  const image = new Image()
  try {
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve()
      image.onerror = () => reject(new Error('无法读取该图片'))
      image.decoding = 'async'
      image.referrerPolicy = 'no-referrer'
      image.src = objectUrl
    })
    return {
      source: image,
      width: image.naturalWidth,
      height: image.naturalHeight,
      dispose: () => URL.revokeObjectURL(objectUrl),
    }
  }
  catch (error) {
    URL.revokeObjectURL(objectUrl)
    throw error
  }
}

function dataUrlBytes(dataUrl: string): number {
  const payload = dataUrl.slice(dataUrl.indexOf(',') + 1)
  return Math.ceil(payload.length * 0.75)
}

function drawSquareIcon(image: DecodedImage, size: number): HTMLCanvasElement {
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const context = canvas.getContext('2d')
  if (!context)
    throw new Error('当前浏览器无法处理图片')

  const scale = Math.min(size / image.width, size / image.height)
  const width = Math.max(1, Math.round(image.width * scale))
  const height = Math.max(1, Math.round(image.height * scale))
  context.imageSmoothingEnabled = true
  context.imageSmoothingQuality = 'high'
  context.drawImage(image.source, (size - width) / 2, (size - height) / 2, width, height)
  return canvas
}

export async function compressServiceIcon(file: File): Promise<string> {
  validateUpload(file)
  const image = await decodeImage(isSvgUpload(file) ? await sanitizeSvgUpload(file) : file)
  if (image.width <= 0 || image.height <= 0) {
    image.dispose()
    throw new Error('图片尺寸无效')
  }

  try {
    for (const size of [128, 96, 64]) {
      const canvas = drawSquareIcon(image, size)
      const webp = canvas.toDataURL('image/webp', 0.86)
      const candidates = webp.startsWith('data:image/webp')
        ? [webp, canvas.toDataURL('image/webp', 0.68), canvas.toDataURL('image/webp', 0.52)]
        : [canvas.toDataURL('image/png')]

      const compressed = candidates.find(candidate => dataUrlBytes(candidate) <= MAX_STORED_ICON_BYTES)
      if (compressed)
        return compressed
    }
  }
  finally {
    image.dispose()
  }

  throw new Error('压缩后的图标仍然过大，请选择更简单的图片')
}
