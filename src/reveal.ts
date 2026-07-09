/** Scroll-triggered reveals with automatic stagger inside .reveal-group,
 *  plus count-up animation for [data-count] stats. */
export function initReveals(): void {
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches

  // stagger indices within groups
  document.querySelectorAll<HTMLElement>('.reveal-group').forEach((group) => {
    group.querySelectorAll<HTMLElement>('.reveal').forEach((el, i) => {
      el.style.setProperty('--reveal-i', String(i))
    })
  })

  const io = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue
        entry.target.classList.add('is-in')
        entry.target
          .querySelectorAll<HTMLElement>('[data-count]')
          .forEach((el) => countUp(el, reduced))
        io.unobserve(entry.target)
      }
    },
    { threshold: 0.18, rootMargin: '0px 0px -5% 0px' },
  )

  document.querySelectorAll('.reveal').forEach((el) => io.observe(el))
}

function countUp(el: HTMLElement, reduced: boolean): void {
  const target = Number(el.dataset.count ?? '0')
  if (reduced || !Number.isFinite(target)) {
    el.textContent = String(target)
    return
  }

  const duration = 1100
  const start = performance.now()
  const ease = (t: number) => 1 - Math.pow(1 - t, 3)

  const frame = (now: number) => {
    const t = Math.min(1, (now - start) / duration)
    el.textContent = String(Math.round(ease(t) * target))
    if (t < 1) requestAnimationFrame(frame)
  }
  requestAnimationFrame(frame)
}
