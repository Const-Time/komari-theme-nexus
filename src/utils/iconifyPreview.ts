const callbacks = new WeakMap<Element, () => void>()
let sharedObserver: IntersectionObserver | null = null

function getSharedObserver(): IntersectionObserver | null {
  if (typeof window === 'undefined' || !('IntersectionObserver' in window))
    return null
  if (!sharedObserver) {
    sharedObserver = new IntersectionObserver((entries, observer) => {
      for (const entry of entries) {
        if (!entry.isIntersecting)
          continue
        callbacks.get(entry.target)?.()
        callbacks.delete(entry.target)
        observer.unobserve(entry.target)
      }
    }, { rootMargin: '80px' })
  }
  return sharedObserver
}

export function observeIconPreview(element: Element, onVisible: () => void): () => void {
  const observer = getSharedObserver()
  if (!observer) {
    onVisible()
    return () => {}
  }

  callbacks.set(element, onVisible)
  observer.observe(element)
  return () => {
    callbacks.delete(element)
    observer.unobserve(element)
  }
}
