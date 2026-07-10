/** Custom cursor with two personalities:
 *  IRL  → a quiet ink dot + lagging ring (Apple-minimal).
 *  ANIME → the ring becomes a spinning reticle (CSS) and the pointer leaves an
 *          ink trail, drawn here on a canvas. */
export function initCursor(): void {
  if (!matchMedia('(hover: hover) and (pointer: fine)').matches) return

  const cursor = document.querySelector<HTMLElement>('.cursor')
  const label = document.querySelector<HTMLElement>('.cursor-label')
  const canvas = document.querySelector<HTMLCanvasElement>('.cursor-trail')
  if (!cursor || !label) return

  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches

  let mx = -100
  let my = -100
  let rx = -100
  let ry = -100
  let visible = false

  document.addEventListener('mousemove', (e) => {
    mx = e.clientX
    my = e.clientY
    if (!visible) {
      visible = true
      rx = mx
      ry = my
      cursor.classList.remove('is-hidden')
    }
  })

  document.addEventListener('mouseleave', () => {
    visible = false
    cursor.classList.add('is-hidden')
  })

  const interactive = 'a, button, [data-cursor], [role="button"]'
  document.addEventListener('mouseover', (e) => {
    const target = (e.target as HTMLElement).closest<HTMLElement>(interactive)
    cursor.classList.toggle('is-active', !!target)
    label.textContent = target?.dataset.cursor ?? ''
  })

  // ---- ink trail (anime world only) --------------------------------------
  const ctx = !reduced && canvas ? canvas.getContext('2d') : null
  const trail: { x: number; y: number; life: number }[] = []
  let dpr = 1
  let lastX = -100
  let lastY = -100

  const resize = () => {
    if (!canvas) return
    dpr = Math.min(window.devicePixelRatio || 1, 2)
    canvas.width = window.innerWidth * dpr
    canvas.height = window.innerHeight * dpr
  }
  if (ctx) {
    resize()
    window.addEventListener('resize', resize)
  }

  const isAnime = () => document.documentElement.dataset.mode === 'anime'

  const drawTrail = () => {
    if (!ctx || !canvas) return

    // seed a new stamp when the pointer has travelled far enough
    if (isAnime() && visible) {
      const d = Math.hypot(mx - lastX, my - lastY)
      if (d > 4) {
        trail.push({ x: mx, y: my, life: 1 })
        lastX = mx
        lastY = my
        if (trail.length > 22) trail.shift()
      }
    }

    ctx.clearRect(0, 0, canvas.width, canvas.height)
    if (!trail.length) return

    const accent =
      getComputedStyle(document.documentElement).getPropertyValue('--accent').trim() ||
      '#dc3a22'

    ctx.save()
    ctx.scale(dpr, dpr)
    ctx.fillStyle = accent
    for (let i = 0; i < trail.length; i++) {
      const p = trail[i]
      p.life -= 0.045
      if (p.life <= 0) continue
      const r = 0.5 + p.life * 5.5 * (i / trail.length + 0.3)
      ctx.globalAlpha = p.life * p.life * 0.5
      ctx.beginPath()
      ctx.arc(p.x, p.y, r, 0, Math.PI * 2)
      ctx.fill()
    }
    ctx.restore()

    // drop fully-faded stamps from the head
    while (trail.length && trail[0].life <= 0) trail.shift()
  }

  const tick = () => {
    rx += (mx - rx) * 0.16
    ry += (my - ry) * 0.16
    cursor.style.setProperty('--cx', `${mx}px`)
    cursor.style.setProperty('--cy', `${my}px`)
    cursor.style.setProperty('--rx', `${rx.toFixed(1)}px`)
    cursor.style.setProperty('--ry', `${ry.toFixed(1)}px`)
    drawTrail()
    requestAnimationFrame(tick)
  }
  requestAnimationFrame(tick)
}
