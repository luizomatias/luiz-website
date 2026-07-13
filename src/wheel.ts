/** The domain plates ride a 3D cylinder: each card sits at a fixed angle
 *  around the axis and the scroll rotates the whole wheel, so plates
 *  sweep through the centre one after another — a coverflow scrubbed by
 *  the page, not an autoplaying carousel. */
export function initWheel(): void {
  const section = document.querySelector<HTMLElement>('.wheel')
  if (!section) return
  const cards = [...section.querySelectorAll<HTMLElement>('.wheel-card')]
  if (cards.length === 0) return

  if (matchMedia('(prefers-reduced-motion: reduce)').matches) {
    section.classList.add('is-static')
    return
  }

  const n = cards.length
  const step = 21 // degrees between plates
  const span = (n - 1) * step
  let radius = 560
  let raf = 0

  // radius follows the card size so the gaps stay consistent across
  // viewports: R = w/2 / tan(step/2), plus a little breathing room
  const measure = () => {
    const w = cards[0].offsetWidth || 200
    radius = (w / 2 / Math.tan(((step / 2) * Math.PI) / 180)) * 1.18
    request()
  }
  new ResizeObserver(measure).observe(cards[0])

  const pose = (offset: number) => {
    cards.forEach((card, i) => {
      const a = i * step - span / 2 + offset
      const front = Math.cos((a * Math.PI) / 180)
      card.style.transform =
        `translate(-50%, -50%) rotateY(${a.toFixed(2)}deg) translateZ(${radius.toFixed(0)}px)` +
        ` scale(${(0.94 + Math.max(0, front) * 0.06).toFixed(4)})`
      card.style.opacity = (0.3 + Math.max(0, front) * 0.7).toFixed(3)
      card.style.visibility = front < 0.03 ? 'hidden' : 'visible'
      card.style.zIndex = String(100 + Math.round(front * 100))
    })
  }

  const update = () => {
    raf = 0
    const rect = section.getBoundingClientRect()
    if (rect.bottom < 0 || rect.top > window.innerHeight) return
    const scrollable = rect.height - window.innerHeight
    if (scrollable <= 0) return
    const p = Math.min(1, Math.max(0, -rect.top / scrollable))
    // first plate centred at p=0, last at p=1
    pose(span / 2 - p * span)
  }

  const request = () => {
    if (!raf) raf = requestAnimationFrame(update)
  }

  document.addEventListener('scroll', request, { passive: true })
  window.addEventListener('resize', request)
  measure()
}
