/** The about lede lights up word by word as it scrolls through the viewport,
 *  reading like a sentence being spoken. */
export function initLede(): void {
  const lede = document.querySelector<HTMLElement>('.about-lede')
  if (!lede) return
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return

  // split into word spans, flattening <em> but keeping its styling via a class
  const words: HTMLElement[] = []
  const frag = document.createDocumentFragment()

  const split = (node: ChildNode, emphasized: boolean) => {
    if (node.nodeType === Node.TEXT_NODE) {
      for (const part of (node.textContent ?? '').split(/(\s+)/)) {
        if (!part) continue
        if (/^\s+$/.test(part)) {
          frag.appendChild(document.createTextNode(' '))
        } else {
          const span = document.createElement('span')
          span.className = emphasized ? 'lede-word lede-word--em' : 'lede-word'
          span.textContent = part
          words.push(span)
          frag.appendChild(span)
        }
      }
    } else if (node instanceof HTMLElement) {
      Array.from(node.childNodes).forEach((n) =>
        split(n, emphasized || node.tagName === 'EM'),
      )
    }
  }

  Array.from(lede.childNodes).forEach((n) => split(n, false))
  lede.textContent = ''
  lede.appendChild(frag)

  let ticking = false

  const update = () => {
    ticking = false
    const rect = lede.getBoundingClientRect()
    const vh = window.innerHeight
    // lights start when the block enters the lower viewport, finish by mid-screen
    const p = (vh * 0.9 - rect.top) / (vh * 0.5 + rect.height)
    const lit = Math.floor(Math.min(1, Math.max(0, p)) * (words.length + 2))
    words.forEach((w, i) => w.classList.toggle('is-lit', i < lit))
  }

  document.addEventListener(
    'scroll',
    () => {
      if (!ticking) {
        ticking = true
        requestAnimationFrame(update)
      }
    },
    { passive: true },
  )
  update()
}
