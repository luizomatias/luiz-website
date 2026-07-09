/**
 * The data flywheel: a living schematic of an ML pipeline, drawn in the
 * site's ink-on-paper language. Data points fall from the top — noisy and
 * scattered (raw), filtered at a gate (preprocess, rejects flash out),
 * snapped into ordered columns (embeddings), absorbed by a pulsing ƒ(θ)
 * box (model) and emitted as clean, regular pulses (deploy). Some outputs
 * ride an arc back to the top: the flywheel.
 */

type Phase = 'raw' | 'reject' | 'embed' | 'model' | 'out' | 'fly'

interface Particle {
  phase: Phase
  x: number
  y: number
  xt: number // target x while falling
  col: number
  seed: number
  size: number
  alpha: number
  t: number // param for fly arc / fades
}

interface RGB {
  r: number
  g: number
  b: number
}

const hex = (s: string): RGB => {
  const v = s.replace('#', '').trim()
  const n = parseInt(
    v.length === 3 ? v.split('').map((c) => c + c).join('') : v,
    16,
  )
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 }
}

const mix = (a: RGB, b: RGB, k: number): RGB => ({
  r: a.r + (b.r - a.r) * k,
  g: a.g + (b.g - a.g) * k,
  b: a.b + (b.b - a.b) * k,
})

const css = (c: RGB, a: number) =>
  `rgba(${c.r | 0}, ${c.g | 0}, ${c.b | 0}, ${a})`

export function initPipeline(): void {
  const host = document.querySelector<HTMLElement>('.pipeline')
  const canvas = host?.querySelector<HTMLCanvasElement>('.pipeline-canvas')
  const ctx = canvas?.getContext('2d')
  if (!host || !canvas || !ctx) return

  const root = document.documentElement
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches

  let w = 0
  let h = 0
  // geometry (recomputed on resize)
  let cx = 0 // flow centreline
  let gateY = 0
  let gateHalf = 0
  let cols: number[] = []
  let embedTop = 0
  let modelTop = 0
  let modelBot = 0
  let modelW = 0

  const layout = () => {
    cx = w * 0.62
    gateY = h * 0.26
    gateHalf = w * 0.09
    embedTop = h * 0.32
    modelTop = h * 0.58
    modelBot = h * 0.68
    modelW = w * 0.42
    cols = [-2, -1, 0, 1, 2].map((i) => cx + i * w * 0.085)
  }

  // theme colors, lerped so world switches glide
  let ink = hex('#181712')
  let accent = hex('#c4552f')
  let inkT = ink
  let accentT = accent

  const readColors = () => {
    const cs = getComputedStyle(root)
    const i = cs.getPropertyValue('--ink').trim()
    const a = cs.getPropertyValue('--accent').trim()
    if (i.startsWith('#')) inkT = hex(i)
    if (a.startsWith('#')) accentT = hex(a)
  }

  new MutationObserver(readColors).observe(root, {
    attributes: true,
    attributeFilter: ['data-mode', 'data-theme'],
  })
  readColors()
  ink = inkT
  accent = accentT

  // ---- particles ----
  const parts: Particle[] = []
  let bank = 0 // absorbed inputs waiting to be emitted
  let emitClock = 0
  let pulse = 0 // model pulse 1 → 0
  let outCount = 0

  const spawnRaw = (yStart = -6) => {
    const keep = Math.random() > 0.16
    parts.push({
      phase: 'raw',
      x: cx + (Math.random() - 0.5) * w * 0.55,
      y: yStart,
      xt: keep
        ? cx + (Math.random() - 0.5) * gateHalf * 1.7
        : cx + (Math.random() < 0.5 ? -1 : 1) * (gateHalf + 8 + Math.random() * w * 0.14),
      col: Math.floor(Math.random() * 5),
      seed: Math.random() * Math.PI * 2,
      size: 1.6 + Math.random() * 0.9,
      alpha: 0.85,
      t: 0,
    })
  }

  // arc: bottom of serve line back up to the spawn zone
  const arc = (t: number) => {
    const x0 = cx
    const y0 = h * 0.96
    const cxq = w * 1.16
    const cyq = h * 0.5
    const x1 = cx + w * 0.06
    const y1 = h * 0.03
    const u = 1 - t
    return {
      x: u * u * x0 + 2 * u * t * cxq + t * t * x1,
      y: u * u * y0 + 2 * u * t * cyq + t * t * y1,
    }
  }

  const step = (dt: number, now: number) => {
    // population control
    const rawCount = parts.filter((p) => p.phase === 'raw').length
    if (rawCount < 16 && Math.random() < dt * 14) spawnRaw()

    emitClock += dt
    if (emitClock > 0.48 && bank > 0) {
      emitClock = 0
      bank--
      pulse = 1
      outCount++
      parts.push({
        phase: 'out',
        x: cx,
        y: modelBot + 4,
        xt: cx,
        col: outCount,
        seed: 0,
        size: 2.3,
        alpha: 1,
        t: 0,
      })
    }
    pulse = Math.max(0, pulse - dt * 2.2)

    for (let i = parts.length - 1; i >= 0; i--) {
      const p = parts[i]
      switch (p.phase) {
        case 'raw': {
          const near = Math.min(1, Math.max(0, 1 - (gateY - p.y) / (h * 0.2)))
          p.y += h * 0.055 * dt * (1 + near * 0.4)
          p.x += (p.xt - p.x) * dt * (0.6 + near * 3)
          p.x += Math.sin(now * 0.0012 + p.seed) * (1 - near) * 0.5
          if (p.y >= gateY) {
            if (Math.abs(p.x - cx) > gateHalf) {
              p.phase = 'reject'
              p.t = 0
            } else {
              p.phase = 'embed'
              // spread evenly across the embedding dimensions
              p.col = Math.floor(Math.random() * cols.length)
            }
          }
          break
        }
        case 'reject': {
          p.t += dt
          p.x += Math.sign(p.x - cx) * w * 0.5 * dt
          p.y += h * 0.01 * dt
          p.alpha = Math.max(0, 0.85 - p.t * 1.7)
          if (p.alpha <= 0) parts.splice(i, 1)
          break
        }
        case 'embed': {
          p.y += h * 0.06 * dt
          p.x += (cols[p.col] - p.x) * dt * 5
          if (p.y >= modelTop - 6) p.phase = 'model'
          break
        }
        case 'model': {
          const my = (modelTop + modelBot) / 2
          p.x += (cx - p.x) * dt * 6
          p.y += (my - p.y) * dt * 6 + h * 0.01 * dt
          p.size = Math.max(0.4, p.size - dt * 3)
          if (Math.abs(p.x - cx) < 3 && Math.abs(p.y - my) < 3) {
            parts.splice(i, 1)
            bank++
          }
          break
        }
        case 'out': {
          p.y += h * 0.11 * dt
          if (p.y >= h * 0.96) {
            if (p.col % 3 === 0) {
              p.phase = 'fly'
              p.t = 0
            } else {
              parts.splice(i, 1)
            }
          }
          break
        }
        case 'fly': {
          p.t += dt * 0.34
          const pos = arc(p.t)
          p.x = pos.x
          p.y = pos.y
          if (p.t >= 1) {
            parts.splice(i, 1)
            spawnRaw(6)
          }
          break
        }
      }
    }
  }

  const drawStructure = (now: number) => {
    ctx.lineWidth = 1

    // gate with an opening
    ctx.strokeStyle = css(ink, 0.45)
    ctx.beginPath()
    ctx.moveTo(w * 0.08, gateY)
    ctx.lineTo(cx - gateHalf, gateY)
    ctx.moveTo(cx + gateHalf, gateY)
    ctx.lineTo(w * 0.98, gateY)
    ctx.stroke()
    // opening ticks
    ctx.beginPath()
    ctx.moveTo(cx - gateHalf, gateY - 5)
    ctx.lineTo(cx - gateHalf, gateY + 5)
    ctx.moveTo(cx + gateHalf, gateY - 5)
    ctx.lineTo(cx + gateHalf, gateY + 5)
    ctx.stroke()

    // embedding column guides
    ctx.strokeStyle = css(ink, 0.13)
    ctx.beginPath()
    for (const x of cols) {
      ctx.moveTo(x, embedTop)
      ctx.lineTo(x, modelTop - 12)
    }
    ctx.stroke()

    // model box + ƒ(θ)
    ctx.strokeStyle = css(ink, 0.6)
    ctx.strokeRect(cx - modelW / 2, modelTop, modelW, modelBot - modelTop)
    ctx.fillStyle = css(ink, 0.55)
    ctx.font = '11px "IBM Plex Mono", monospace'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText('ƒ(θ)', cx, (modelTop + modelBot) / 2 + 0.5)

    // model pulse on emit
    if (pulse > 0) {
      const g = 10 * (1 - pulse)
      ctx.strokeStyle = css(accent, pulse * 0.8)
      ctx.strokeRect(
        cx - modelW / 2 - g,
        modelTop - g,
        modelW + g * 2,
        modelBot - modelTop + g * 2,
      )
    }

    // serve line
    ctx.strokeStyle = css(ink, 0.18)
    ctx.beginPath()
    ctx.moveTo(cx, modelBot + 6)
    ctx.lineTo(cx, h * 0.97)
    ctx.stroke()

    // flywheel return arc (dashed, flowing upward)
    ctx.strokeStyle = css(accent, 0.4)
    ctx.setLineDash([3, 5])
    ctx.lineDashOffset = (now * 0.014) % 8
    ctx.beginPath()
    const a0 = arc(0)
    ctx.moveTo(a0.x, a0.y)
    ctx.quadraticCurveTo(w * 1.16, h * 0.5, arc(1).x, arc(1).y)
    ctx.stroke()
    ctx.setLineDash([])
    // arrowhead at the top of the arc
    const tip = arc(1)
    ctx.fillStyle = css(accent, 0.55)
    ctx.beginPath()
    ctx.moveTo(tip.x, tip.y)
    ctx.lineTo(tip.x + 5, tip.y + 7)
    ctx.lineTo(tip.x - 3, tip.y + 6)
    ctx.closePath()
    ctx.fill()
  }

  const drawParticles = () => {
    for (const p of parts) {
      const isAccent = p.phase === 'reject' || p.phase === 'out' || p.phase === 'fly'
      const alpha =
        p.phase === 'fly' ? 0.9 : p.phase === 'out' ? 1 : Math.min(1, p.alpha)
      ctx.fillStyle = css(isAccent ? accent : ink, alpha)
      ctx.beginPath()
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2)
      ctx.fill()
    }
  }

  let last = 0
  let raf = 0
  let running = false

  const frame = (now: number) => {
    raf = 0
    const dt = Math.min(0.05, (now - last) / 1000 || 0.016)
    last = now
    ink = mix(ink, inkT, 0.08)
    accent = mix(accent, accentT, 0.08)
    ctx.clearRect(0, 0, w, h)
    step(dt, now)
    drawStructure(now)
    drawParticles()
    if (running && !document.hidden) raf = requestAnimationFrame(frame)
  }

  const start = () => {
    if (!raf && running && !document.hidden) {
      last = performance.now()
      raf = requestAnimationFrame(frame)
    }
  }

  const resize = () => {
    const dpr = Math.min(2, window.devicePixelRatio || 1)
    const r = host.getBoundingClientRect()
    if (r.width === 0) return
    w = r.width
    h = r.height
    canvas.width = Math.round(w * dpr)
    canvas.height = Math.round(h * dpr)
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    layout()
    if (reduced) staticFrame()
  }

  // reduced motion: a single, calm schematic frame
  const staticFrame = () => {
    ctx.clearRect(0, 0, w, h)
    drawStructure(0)
    ctx.fillStyle = css(ink, 0.7)
    for (let i = 0; i < 14; i++) {
      const t = (i * 137.5) % 1000 / 1000
      const y = t * gateY * 0.9
      const x = cx + Math.sin(i * 2.4) * w * 0.2
      ctx.beginPath()
      ctx.arc(x, y, 1.8, 0, Math.PI * 2)
      ctx.fill()
    }
    for (const [ci, x] of cols.entries()) {
      ctx.beginPath()
      ctx.arc(x, embedTop + ((ci * 61) % 100) / 100 * (modelTop - embedTop - 20), 1.8, 0, Math.PI * 2)
      ctx.fill()
    }
    ctx.fillStyle = css(accent, 0.9)
    for (let i = 0; i < 3; i++) {
      ctx.beginPath()
      ctx.arc(cx, modelBot + 20 + i * (h * 0.29 - modelBot) * 0.35 + i * 24, 2.3, 0, Math.PI * 2)
      ctx.fill()
    }
  }

  new ResizeObserver(resize).observe(host)
  resize()

  if (reduced) return

  // warm start: pre-fill the flow so it doesn't begin empty
  for (let i = 0; i < 26; i++) {
    spawnRaw(Math.random() * gateY)
  }
  bank = 2

  new IntersectionObserver(
    (entries) => {
      running = entries.some((e) => e.isIntersecting)
      if (running) start()
    },
    { rootMargin: '80px' },
  ).observe(host)

  document.addEventListener('visibilitychange', start)
}
