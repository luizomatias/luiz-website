/** Hairline scroll-progress bar along the top edge. */
export function initProgress(): void {
  const root = document.documentElement
  let ticking = false

  const update = () => {
    ticking = false
    const max = root.scrollHeight - root.clientHeight
    const p = max > 0 ? root.scrollTop / max : 0
    root.style.setProperty('--scroll-progress', p.toFixed(4))
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
