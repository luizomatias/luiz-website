/** Inertial smooth scroll: wheel input feeds a target that the page glides
 *  toward each frame. Native scroll is kept for touch devices, keyboard,
 *  and scrollbar dragging (we re-sync from the scroll event). */
export function initSmoothScroll(): void {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return
  // touch devices keep their native, already-inertial scroll
  if (!matchMedia('(hover: hover) and (pointer: fine)').matches) return

  const root = document.documentElement
  // we drive the position ourselves; CSS smooth would double-animate
  root.style.scrollBehavior = 'auto'

  let target = window.scrollY
  let current = window.scrollY
  let raf = 0

  const maxScroll = () => root.scrollHeight - window.innerHeight

  const start = () => {
    if (!raf) raf = requestAnimationFrame(tick)
  }

  const tick = () => {
    raf = 0
    current += (target - current) * 0.11
    if (Math.abs(target - current) < 0.5) {
      current = target
      window.scrollTo(0, current)
      return
    }
    window.scrollTo(0, current)
    raf = requestAnimationFrame(tick)
  }

  window.addEventListener(
    'wheel',
    (e: WheelEvent) => {
      if (e.ctrlKey) return // pinch-zoom
      e.preventDefault()
      const unit = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? window.innerHeight : 1
      target = Math.max(0, Math.min(maxScroll(), target + e.deltaY * unit))
      start()
    },
    { passive: false },
  )

  // keyboard / scrollbar / history jumps: adopt the new position
  window.addEventListener(
    'scroll',
    () => {
      if (!raf) {
        target = window.scrollY
        current = window.scrollY
      }
    },
    { passive: true },
  )

  // anchor navigation glides through the same physics
  document.querySelectorAll<HTMLAnchorElement>('a[href^="#"]').forEach((a) => {
    a.addEventListener('click', (e) => {
      const id = (a.getAttribute('href') ?? '').slice(1)
      const el = document.getElementById(id)
      if (!el) return
      e.preventDefault()
      target = Math.max(
        0,
        Math.min(maxScroll(), el.getBoundingClientRect().top + window.scrollY),
      )
      start()
      history.pushState(null, '', `#${id}`)
    })
  })
}
