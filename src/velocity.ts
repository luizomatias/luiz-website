/** Scroll-velocity skew: the marquee bands lean into fast scrolling and
 *  ease back upright when it settles. */
export function initVelocity(): void {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return

  const root = document.documentElement
  let lastY = window.scrollY
  let skew = 0
  let idle = true

  const tick = () => {
    const y = window.scrollY
    const target = Math.max(-5, Math.min(5, (y - lastY) * 0.12))
    lastY = y
    skew += (target - skew) * 0.12

    if (Math.abs(skew) < 0.02 && target === 0) {
      skew = 0
      root.style.setProperty('--scroll-skew', '0deg')
      idle = true
      return
    }
    root.style.setProperty('--scroll-skew', `${skew.toFixed(2)}deg`)
    requestAnimationFrame(tick)
  }

  document.addEventListener(
    'scroll',
    () => {
      if (idle) {
        idle = false
        lastY = window.scrollY
        requestAnimationFrame(tick)
      }
    },
    { passive: true },
  )
}
