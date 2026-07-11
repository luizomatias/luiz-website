/**
 * Ambient life for the anime world: sakura petals drift by day,
 * fireflies pulse in the night sky. Idle in the IRL world.
 * Canvas-based, DPR-aware, cursor-reactive, pauses when the tab hides.
 */

type Ambience = 'off' | 'day' | 'night'

interface Petal {
  x: number
  y: number
  vx: number
  vy: number
  size: number
  angle: number
  spin: number
  sway: number
  phase: number
  hue: number
}

interface Firefly {
  x: number
  y: number
  vx: number
  vy: number
  size: number
  phase: number
  speed: number
}

export function initAmbient(): void {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return

  const canvas = document.querySelector<HTMLCanvasElement>('.ambient')
  const ctx = canvas?.getContext('2d')
  if (!canvas || !ctx) return

  const root = document.documentElement
  let w = 0
  let h = 0
  let dpr = 1
  let petals: Petal[] = []
  let flies: Firefly[] = []
  let mode: Ambience = 'off'
  let raf = 0
  let last = 0
  let mx = -1000
  let my = -1000

  const resize = () => {
    dpr = Math.min(2, window.devicePixelRatio || 1)
    w = window.innerWidth
    h = window.innerHeight
    canvas.width = Math.round(w * dpr)
    canvas.height = Math.round(h * dpr)
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    populate()
  }

  const populate = () => {
    const petalCount = Math.min(22, Math.round((w * h) / 70000))
    const flyCount = Math.min(24, Math.round((w * h) / 68000))

    petals = Array.from({ length: petalCount }, () => spawnPetal(true))
    flies = Array.from({ length: flyCount }, () => ({
      x: Math.random() * w,
      y: Math.random() * h,
      vx: 0,
      vy: 0,
      size: 1 + Math.random() * 1.8,
      phase: Math.random() * Math.PI * 2,
      speed: 0.6 + Math.random() * 1.2,
    }))
  }

  const spawnPetal = (anywhere: boolean): Petal => ({
    x: Math.random() * (w + 200) - 100,
    y: anywhere ? Math.random() * h : -30,
    vx: 0,
    vy: 26 + Math.random() * 34,
    size: 5 + Math.random() * 8,
    angle: Math.random() * Math.PI * 2,
    spin: (Math.random() - 0.5) * 2.4,
    sway: 14 + Math.random() * 22,
    phase: Math.random() * Math.PI * 2,
    hue: Math.random(),
  })

  const readMode = (): Ambience => {
    if (root.dataset.mode !== 'anime') return 'off'
    return root.dataset.theme === 'dark' ? 'night' : 'day'
  }

  const drawPetal = (p: Petal, t: number) => {
    const alpha = 0.55 + p.hue * 0.35
    ctx.save()
    ctx.translate(p.x, p.y)
    ctx.rotate(p.angle + Math.sin(t * 0.001 + p.phase) * 0.4)
    ctx.scale(1, 0.62 + Math.sin(t * 0.002 + p.phase) * 0.22)
    const light = 82 - p.hue * 14
    ctx.fillStyle = `hsla(${338 + p.hue * 14}, 78%, ${light}%, ${alpha})`
    ctx.beginPath()
    ctx.moveTo(0, -p.size)
    ctx.quadraticCurveTo(p.size * 0.9, -p.size * 0.25, 0, p.size)
    ctx.quadraticCurveTo(-p.size * 0.9, -p.size * 0.25, 0, -p.size)
    ctx.fill()
    ctx.restore()
  }

  const drawFly = (f: Firefly, t: number) => {
    const pulse = 0.3 + 0.7 * Math.abs(Math.sin(t * 0.001 * f.speed + f.phase))
    const r = f.size * (4 + pulse * 7)
    const g = ctx.createRadialGradient(f.x, f.y, 0, f.x, f.y, r)
    g.addColorStop(0, `rgba(255, 224, 138, ${0.75 * pulse})`)
    g.addColorStop(0.35, `rgba(255, 196, 110, ${0.28 * pulse})`)
    g.addColorStop(1, 'rgba(255, 196, 110, 0)')
    ctx.fillStyle = g
    ctx.beginPath()
    ctx.arc(f.x, f.y, r, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = `rgba(255, 244, 200, ${0.55 + 0.45 * pulse})`
    ctx.beginPath()
    ctx.arc(f.x, f.y, f.size, 0, Math.PI * 2)
    ctx.fill()
  }

  const tick = (now: number) => {
    raf = 0
    const dt = Math.min(0.05, (now - last) / 1000 || 0.016)
    last = now
    ctx.clearRect(0, 0, w, h)

    if (mode === 'day') {
      for (const p of petals) {
        // wind + sway + gentle cursor repulsion
        const dx = p.x - mx
        const dy = p.y - my
        const d2 = dx * dx + dy * dy
        if (d2 < 8100) {
          const d = Math.sqrt(d2) || 1
          const f = (1 - d / 90) * 140
          p.vx += (dx / d) * f * dt
          p.vy += (dy / d) * f * dt * 0.4
        }
        p.vx += (Math.sin(now * 0.0004 + p.phase) * p.sway - p.vx) * dt
        p.x += (p.vx + 10) * dt
        p.y += p.vy * dt
        p.angle += p.spin * dt
        if (p.y > h + 30 || p.x > w + 120) {
          Object.assign(p, spawnPetal(false))
        }
        drawPetal(p, now)
      }
    } else if (mode === 'night') {
      for (const f of flies) {
        f.vx += (Math.sin(now * 0.00023 * f.speed + f.phase) * 9 - f.vx * 0.6) * dt
        f.vy += (Math.cos(now * 0.00031 * f.speed + f.phase * 1.7) * 7 - f.vy * 0.6) * dt
        const dx = f.x - mx
        const dy = f.y - my
        const d2 = dx * dx + dy * dy
        if (d2 < 10000) {
          const d = Math.sqrt(d2) || 1
          f.vx += (dx / d) * 60 * dt
          f.vy += (dy / d) * 60 * dt
        }
        f.x += f.vx * dt * 6
        f.y += f.vy * dt * 6
        if (f.x < -20) f.x = w + 20
        if (f.x > w + 20) f.x = -20
        if (f.y < -20) f.y = h + 20
        if (f.y > h + 20) f.y = -20
        drawFly(f, now)
      }
    }

    if (mode !== 'off' && !document.hidden) {
      raf = requestAnimationFrame(tick)
    }
  }

  const sync = () => {
    const next = readMode()
    if (next === mode) return
    mode = next
    canvas.style.opacity = mode === 'off' ? '0' : '0.58'
    if (mode !== 'off' && !raf && !document.hidden) {
      last = performance.now()
      raf = requestAnimationFrame(tick)
    }
    if (mode === 'off') {
      // let the fade-out finish, then clear
      window.setTimeout(() => {
        if (mode === 'off') ctx.clearRect(0, 0, w, h)
      }, 700)
    }
  }

  new MutationObserver(sync).observe(root, {
    attributes: true,
    attributeFilter: ['data-mode', 'data-theme'],
  })

  document.addEventListener('visibilitychange', () => {
    if (!document.hidden && mode !== 'off' && !raf) {
      last = performance.now()
      raf = requestAnimationFrame(tick)
    }
  })

  window.addEventListener('resize', resize)
  document.addEventListener('mousemove', (e) => {
    mx = e.clientX
    my = e.clientY
  })

  resize()
  sync()
}
