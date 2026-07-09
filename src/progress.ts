/** Hairline scroll-progress bar along the top edge, plus the page-wide
 *  background shift — the world subtly deepens toward the footer. */
export function initProgress(): void {
  const root = document.documentElement
  let ticking = false

  const update = () => {
    ticking = false
    const max = root.scrollHeight - root.clientHeight
    const p = max > 0 ? root.scrollTop / max : 0
    root.style.setProperty('--scroll-progress', p.toFixed(4))
    // ease-in so the shift is felt in the back half of the page
    root.style.setProperty('--bg-shift', (p * p).toFixed(4))
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
