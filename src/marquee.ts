/** The marquee is driven by scroll, not a keyframe loop: it drifts slowly
 *  on its own, leans into your scroll velocity, and reverses direction when
 *  you scroll back up. Kinetic type, not a template ticker. */
export function initMarquee(): void {
  const wrap = document.querySelector<HTMLElement>('.marquee')
  const track = document.querySelector<HTMLElement>('.marquee-track')
  if (!wrap || !track) return
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return

  // the track holds two copies of the phrase list; wrap at the halfway point
  let half = 0
  new ResizeObserver(() => {
    half = track.scrollWidth / 2
  }).observe(track)

  let x = 0
  let lastY = window.scrollY
  let vel = 0
  let raf = 0
  let last = 0
  let visible = true

  const tick = (now: number) => {
    raf = 0
    const dt = Math.min(0.05, (now - last) / 1000 || 0.016)
    last = now

    // smoothed scroll velocity (px per frame); the strip leans into it,
    // and scrolling back up pushes it the other way
    const y = window.scrollY
    vel += (y - lastY - vel) * 0.12
    lastY = y
    const kick = Math.max(-520, Math.min(520, vel * 10))

    x -= (46 + kick) * dt
    if (half > 0) {
      let m = x % half
      if (m > 0) m -= half
      x = m
    }
    track.style.transform = `translate3d(${x.toFixed(2)}px, 0, 0)`

    if (visible && !document.hidden) raf = requestAnimationFrame(tick)
  }

  const start = () => {
    if (raf || !visible || document.hidden) return
    lastY = window.scrollY
    vel = 0
    last = performance.now()
    raf = requestAnimationFrame(tick)
  }

  new IntersectionObserver((entries) => {
    visible = entries[0].isIntersecting
    if (visible) start()
  }).observe(wrap)

  document.addEventListener('visibilitychange', start)
  start()
}
