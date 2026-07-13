/** Opening-credits sequence for the domains: the stage sticks to the
 *  viewport while the section's extra height gives the scroll room to
 *  scrub through the cards. Each card dissolves in around the centre of
 *  its segment with a slow rise and a Ken Burns micro-zoom, and hands
 *  over to the next in a crossfade — film titles, not a ticker. */
export function initCredits(): void {
  const section = document.querySelector<HTMLElement>('.credits')
  if (!section) return
  const cards = [...section.querySelectorAll<HTMLElement>('.credits-card')]
  const ticks = [...section.querySelectorAll<HTMLElement>('.credits-tick')]
  if (cards.length === 0) return

  if (matchMedia('(prefers-reduced-motion: reduce)').matches) {
    section.classList.add('is-static')
    return
  }

  const n = cards.length
  let raf = 0

  const update = () => {
    raf = 0
    const rect = section.getBoundingClientRect()
    if (rect.bottom < 0 || rect.top > window.innerHeight) return

    const scrollable = rect.height - window.innerHeight
    if (scrollable <= 0) return
    const p = Math.min(1, Math.max(0, -rect.top / scrollable))
    const seg = 1 / n

    cards.forEach((card, i) => {
      const centre = (i + 0.5) * seg
      // 0 at the segment centre → 1 a bit past its edges; adjacent cards
      // overlap slightly, which is what makes it read as a dissolve
      const d = Math.abs(p - centre) / seg
      const vis = Math.max(0, 1 - (d * 1.6) ** 2)
      const dir = p < centre ? 1 : -1
      card.style.opacity = vis.toFixed(3)
      card.style.transform =
        `translateY(${(dir * (1 - vis) * 30).toFixed(1)}px) scale(${(0.97 + vis * 0.03).toFixed(4)})`
      card.style.visibility = vis <= 0 ? 'hidden' : 'visible'
    })

    const idx = Math.min(n - 1, Math.floor(p * n))
    ticks.forEach((t, i) => t.classList.toggle('is-on', i === idx))
  }

  const request = () => {
    if (!raf) raf = requestAnimationFrame(update)
  }

  document.addEventListener('scroll', request, { passive: true })
  window.addEventListener('resize', request)
  update()
}
