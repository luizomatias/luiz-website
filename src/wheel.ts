/** The domain plates ride a full 360° carousel that spins on its own —
 *  slow, continuous, wrapping around so the first plate keeps returning
 *  to the back of the queue. Plates are double-sided: the far side of
 *  the cylinder shows their printed backs. No sticky stage, no scroll
 *  trap; it turns quietly in normal flow and pauses offscreen. */
export function initWheel(): void {
  const section = document.querySelector<HTMLElement>('.wheel')
  if (!section) return
  const cards = [...section.querySelectorAll<HTMLElement>('.wheel-card')]
  if (cards.length === 0) return

  // build the double side: front keeps the existing art + label, the
  // back gets a printed monogram and plate number
  const n = cards.length
  cards.forEach((card, i) => {
    const front = document.createElement('div')
    front.className = 'wheel-face wheel-face--front'
    while (card.firstChild) front.appendChild(card.firstChild)
    const back = document.createElement('div')
    back.className = 'wheel-face wheel-face--back'
    back.setAttribute('aria-hidden', 'true')
    back.innerHTML =
      `<span class="wheel-back-mark">Lz</span>` +
      `<span class="wheel-back-index mono">${String(i + 1).padStart(2, '0')} / ${String(n).padStart(2, '0')}</span>`
    card.append(front, back)
  })

  if (matchMedia('(prefers-reduced-motion: reduce)').matches) {
    section.classList.add('is-static')
    return
  }

  const step = 360 / n
  let radius = 170

  // radius follows the card size so the plates keep a consistent gap
  const measure = () => {
    const w = cards[0].offsetWidth || 110
    radius = (w / 2 / Math.tan(((step / 2) * Math.PI) / 180)) * 1.45
  }
  new ResizeObserver(measure).observe(cards[0])

  let angle = 0
  let raf = 0
  let last = 0
  let visible = false

  const pose = () => {
    cards.forEach((card, i) => {
      const a = i * step + angle
      card.style.transform =
        `translate(-50%, -50%) rotateY(${a.toFixed(2)}deg) translateZ(${radius.toFixed(0)}px)`
    })
  }

  const tick = (now: number) => {
    raf = 0
    const dt = Math.min(0.05, (now - last) / 1000 || 0.016)
    last = now
    angle = (angle - 8 * dt) % 360 // one full turn ≈ 45s
    pose()
    if (visible && !document.hidden) raf = requestAnimationFrame(tick)
  }

  const start = () => {
    if (raf || !visible || document.hidden) return
    last = performance.now()
    raf = requestAnimationFrame(tick)
  }

  new IntersectionObserver((entries) => {
    visible = entries[0].isIntersecting
    if (visible) start()
  }).observe(section)
  document.addEventListener('visibilitychange', start)

  measure()
  pose()
}
