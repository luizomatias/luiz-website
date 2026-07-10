/** [ EMBED → R³ ] — the hero name dissolves into a rotating 3D point cloud:
 *  each word of the name becomes a cluster in a toy latent space (which is,
 *  not by accident, his actual line of work). DECODE flies the points back
 *  and reforms the type. Canvas 2D with hand-rolled 3D projection — no deps.
 *
 *  Particle homes come from sampling the real rendered glyphs: each .char
 *  span is redrawn on an offscreen canvas with its computed font and the ink
 *  pixels become dots. Screen mapping uses fontBoundingBoxAscent so the
 *  reformed cloud lands exactly on the type before the crossfade.
 */

type Phase = 'off' | 'in' | 'on' | 'out' | 'fade'

interface Pt {
  hx: number // home over the type (canvas px)
  hy: number
  x: number // latent-space target
  y: number
  z: number
  d: number // stagger delay (ms)
  a: boolean // accent-coloured
  s: number // base dot size
  w: number // word / cluster index
}

const DUR = 950
const FOCAL = 1150 // long lens: keeps near points from ballooning over the page
const CAP = 1500

const ease = (t: number) =>
  t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2

const clamp01 = (v: number) => Math.min(1, Math.max(0, v))

export function initEmbed(): void {
  const hero = document.querySelector<HTMLElement>('.hero')
  const title = document.querySelector<HTMLElement>('.hero-title')
  const btn = document.getElementById('embed-toggle') as HTMLButtonElement | null
  const canvas = document.querySelector<HTMLCanvasElement>('.embed-canvas')
  if (!hero || !title || !btn || !canvas) return

  if (matchMedia('(prefers-reduced-motion: reduce)').matches) {
    btn.remove()
    canvas.remove()
    return
  }
  const ctx = canvas.getContext('2d')
  if (!ctx) return

  let phase: Phase = 'off'
  let pts: Pt[] = []
  let links: Array<[number, number]> = []
  let maxDelay = 0
  let t0 = 0
  let tFade = 0
  let raf = 0
  let last = 0
  let dpr = 1
  let cw = 0
  let ch = 0
  let cx0 = 0
  let cy0 = 0
  let R = 0
  let yaw = 0.45
  let pitch = -0.16
  let vyaw = 0
  let vpitch = 0
  let dragging = false

  const css = (name: string) =>
    getComputedStyle(document.documentElement).getPropertyValue(name).trim()

  const gauss = () => {
    const u = Math.random() || 1e-6
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * Math.random())
  }

  const resize = () => {
    dpr = Math.min(window.devicePixelRatio || 1, 2)
    cw = hero.offsetWidth
    ch = hero.offsetHeight
    canvas.width = cw * dpr
    canvas.height = ch * dpr
  }

  // ---- sample the rendered glyph ink into particles ----------------------
  const sample = (): void => {
    pts = []
    links = []
    const heroR = hero.getBoundingClientRect()
    const off = document.createElement('canvas')
    const octx = off.getContext('2d')
    if (!octx) return

    let word = -1
    let inWord = false
    const raw: Pt[] = []

    title.querySelectorAll<HTMLElement>('.hero-line').forEach((line) => {
      inWord = false
      line.querySelectorAll<HTMLElement>('.char').forEach((char) => {
        let t = char.textContent ?? ''
        if (!t.trim()) {
          inWord = false
          return
        }
        if (!inWord) {
          word++
          inWord = true
        }
        const r = char.getBoundingClientRect()
        if (r.width < 1) return
        const cs = getComputedStyle(char)
        if (cs.textTransform === 'uppercase') t = t.toUpperCase()
        const fs = parseFloat(cs.fontSize)
        const pad = Math.ceil(fs * 0.3)
        const w = Math.ceil(r.width) + pad * 2
        const h = Math.ceil(r.height) + pad * 2
        off.width = w
        off.height = h
        octx.font = `${cs.fontStyle} ${cs.fontWeight} ${fs}px ${cs.fontFamily}`
        octx.textBaseline = 'alphabetic'
        octx.fillStyle = '#000'
        const asc = octx.measureText(t).fontBoundingBoxAscent || fs * 0.78
        octx.fillText(t, pad, pad + asc)

        const step = Math.max(4, Math.round(fs / 20))
        const img = octx.getImageData(0, 0, w, h).data
        for (let y = 0; y < h; y += step) {
          for (let x = 0; x < w; x += step) {
            if (img[(y * w + x) * 4 + 3] > 140) {
              raw.push({
                hx: r.left - heroR.left + x - pad,
                hy: r.top - heroR.top + y - pad,
                x: 0,
                y: 0,
                z: 0,
                d: 0,
                a: Math.random() < 0.07,
                s: 1.3 + Math.random() * 1.2,
                w: word,
              })
            }
          }
        }
      })
    })

    // thin down to the cap, keeping shape
    const k = Math.max(1, Math.ceil(raw.length / CAP))
    pts = raw.filter((_, i) => i % k === 0)

    // latent-space targets: one cluster per word, ring-ish in 3D.
    // Anchor the cloud to the title's own box — the space the name vacated —
    // so it composes on any viewport instead of drifting over other content.
    const words = word + 1
    const tr = title.getBoundingClientRect()
    R = Math.min(tr.width * 0.38, cw * 0.28, 200)
    cx0 = tr.left - heroR.left + tr.width / 2
    cy0 = tr.top - heroR.top + tr.height / 2
    const sigma = R * 0.28
    for (const p of pts) {
      const a = (p.w / words) * Math.PI * 2 + 0.7
      p.x = Math.cos(a) * R + gauss() * sigma
      p.y = Math.sin(a) * R * 0.55 + gauss() * sigma * 0.8
      p.z = Math.sin(a * 1.7) * R * 0.8 + gauss() * sigma
      p.d = p.w * 110 + Math.random() * 380
    }
    maxDelay = (words - 1) * 110 + 380

    // sparse nearest-neighbour links inside each cluster
    for (let wIdx = 0; wIdx < words; wIdx++) {
      const idx = pts
        .map((p, i) => (p.w === wIdx ? i : -1))
        .filter((i) => i >= 0)
        .sort(() => Math.random() - 0.5)
        .slice(0, 12)
      for (const i of idx) {
        let best = -1
        let bd = Infinity
        for (const j of idx) {
          if (j === i) continue
          const p = pts[i]
          const q = pts[j]
          const d2 = (p.x - q.x) ** 2 + (p.y - q.y) ** 2 + (p.z - q.z) ** 2
          if (d2 < bd) {
            bd = d2
            best = j
          }
        }
        // only short hops — long chords read as clutter, not structure
        if (best >= 0 && bd < (R * 0.85) ** 2) links.push([i, best])
      }
    }
  }

  // ---- projection ---------------------------------------------------------
  const proj = (x: number, y: number, z: number) => {
    const cy = Math.cos(yaw)
    const sy = Math.sin(yaw)
    const cp = Math.cos(pitch)
    const sp = Math.sin(pitch)
    const x1 = x * cy + z * sy
    const z1 = -x * sy + z * cy
    const y1 = y * cp - z1 * sp
    const z2 = y * sp + z1 * cp
    const s = FOCAL / (FOCAL + z2)
    return { x: cx0 + x1 * s, y: cy0 + y1 * s, s }
  }

  const overall = (now: number) =>
    phase === 'on'
      ? 1
      : phase === 'in'
        ? clamp01((now - t0) / (maxDelay + DUR))
        : phase === 'out'
          ? 1 - clamp01((now - t0) / (maxDelay + DUR))
          : 0

  const pe = (p: Pt, now: number) => {
    if (phase === 'on') return 1
    if (phase === 'in') return ease(clamp01((now - t0 - p.d) / DUR))
    if (phase === 'out') return 1 - ease(clamp01((now - t0 - p.d) / DUR))
    return 0
  }

  // ---- main loop -----------------------------------------------------------
  const loop = (now: number) => {
    const dt = Math.min(2.5, (now - last) / 16.7 || 1)
    last = now

    // rotation: inertia from dragging, slow idle spin
    if (!dragging) {
      yaw += vyaw * dt + 0.0022 * dt * (phase === 'on' ? 1 : 0.4)
      pitch += vpitch * dt
      vyaw *= Math.pow(0.94, dt)
      vpitch *= Math.pow(0.94, dt)
      pitch = Math.max(-0.9, Math.min(0.9, pitch))
    }

    ctx.clearRect(0, 0, canvas.width, canvas.height)
    ctx.save()
    ctx.scale(dpr, dpr)

    const ink = css('--ink') || '#1d1d1f'
    const soft = css('--ink-soft') || '#6e6e73'
    const accent = css('--accent') || '#0071e3'
    const g = overall(now)
    const wob = now * 0.0006

    if (phase === 'fade') {
      // dots rest on the ink while the real type fades back in over them
      const k = clamp01((now - tFade) / 380)
      ctx.globalAlpha = 1 - k
      ctx.fillStyle = ink
      for (const p of pts) ctx.fillRect(p.hx - 1.1, p.hy - 1.1, 2.2, 2.2)
      ctx.restore()
      if (k >= 1) {
        stop()
        return
      }
      raf = requestAnimationFrame(loop)
      return
    }

    // project every particle at its eased position
    const sp: Array<{ x: number; y: number; s: number; e: number; p: Pt }> = []
    for (const p of pts) {
      const e = pe(p, now)
      const pr = proj(
        p.x + Math.sin(wob + p.hx) * R * 0.012,
        p.y + Math.cos(wob + p.hy) * R * 0.012,
        p.z,
      )
      sp.push({
        x: p.hx + (pr.x - p.hx) * e,
        y: p.hy + (pr.y - p.hy) * e,
        s: pr.s,
        e,
        p,
      })
    }

    // cluster links, once mostly formed
    if (g > 0.55) {
      ctx.strokeStyle = soft
      ctx.lineWidth = 0.6
      for (const [i, j] of links) {
        const A = sp[i]
        const B = sp[j]
        const a = Math.min(A.e, B.e)
        if (a < 0.6) continue
        ctx.globalAlpha = 0.14 * a * g
        ctx.beginPath()
        ctx.moveTo(A.x, A.y)
        ctx.lineTo(B.x, B.y)
        ctx.stroke()
      }
    }

    // axes of the latent space
    if (g > 0.6) {
      const L = R * 1.18
      const O = proj(0, 0, 0)
      const axes: Array<[number, number, number, string]> = [
        [L, 0, 0, 'dim 0'],
        [0, -L, 0, 'dim 1'],
        [0, 0, L, 'dim 2'],
      ]
      ctx.strokeStyle = soft
      ctx.fillStyle = soft
      ctx.lineWidth = 0.8
      ctx.font = '10px "IBM Plex Mono", monospace'
      for (const [ax, ay, az, label] of axes) {
        const E = proj(ax, ay, az)
        ctx.globalAlpha = 0.3 * (g - 0.6) * 2.5
        ctx.beginPath()
        ctx.moveTo(O.x, O.y)
        ctx.lineTo(E.x, E.y)
        ctx.stroke()
        ctx.fillText(label, E.x + 5, E.y - 4)
      }
    }

    // points, far to near (projection scale doubles as depth)
    sp.sort((a, b) => a.s - b.s)
    for (const q of sp) {
      const depth = 0.4 + 0.6 * clamp01((q.s - 0.65) / 0.6)
      const size = 2.2 + (q.p.s * q.s - 2.2) * q.e
      ctx.globalAlpha = (1 - q.e) * 0.95 + q.e * depth * 0.9
      ctx.fillStyle = q.p.a ? accent : ink
      ctx.fillRect(q.x - size / 2, q.y - size / 2, size, size)
    }

    // caption, tucked under the cloud (wide screens only — on touch the
    // DECODE chip explains itself and there is no esc key)
    if (phase === 'on' && cw > 640) {
      ctx.globalAlpha = 0.55
      ctx.fillStyle = soft
      ctx.font = '10px "IBM Plex Mono", monospace'
      ctx.fillText(
        'name.embed(dim=3) · drag to rotate · esc to decode',
        cx0 - R * 1.1,
        cy0 + R * 1.75,
      )
    }

    ctx.restore()

    // phase transitions
    if (phase === 'in' && now - t0 > maxDelay + DUR) {
      phase = 'on'
      btn.disabled = false
    } else if (phase === 'out' && now - t0 > maxDelay + DUR) {
      phase = 'fade'
      tFade = now
      hero.classList.remove('is-embedded')
    }
    raf = requestAnimationFrame(loop)
  }

  const stop = () => {
    cancelAnimationFrame(raf)
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    phase = 'off'
    btn.disabled = false
    btn.textContent = 'EMBED THE NAME → R³'
    hero.classList.remove('is-embedded', 'is-dragging')
  }

  const activate = () => {
    resize()
    sample()
    if (!pts.length) return
    yaw = 0.45
    pitch = -0.16
    vyaw = 0
    vpitch = 0
    hero.classList.add('is-embedded')
    btn.textContent = '← DECODE'
    btn.disabled = true
    phase = 'in'
    t0 = performance.now()
    last = t0
    raf = requestAnimationFrame(loop)
  }

  const decode = () => {
    phase = 'out'
    t0 = performance.now()
    btn.disabled = true
    btn.textContent = 'EMBED THE NAME → R³'
  }

  btn.addEventListener('click', () => {
    if (phase === 'off') activate()
    else if (phase === 'on') decode()
  })

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && phase === 'on') decode()
  })

  // drag to rotate the cloud (skips links/buttons/portrait)
  hero.addEventListener('pointerdown', (e) => {
    if (phase !== 'on') return
    if ((e.target as HTMLElement).closest('a, button, [role="button"]')) return
    dragging = true
    window.getSelection()?.removeAllRanges()
    hero.classList.add('is-dragging')
    hero.setPointerCapture(e.pointerId)
  })
  hero.addEventListener('pointermove', (e) => {
    if (!dragging) return
    yaw += e.movementX * 0.006
    pitch = Math.max(-0.9, Math.min(0.9, pitch + e.movementY * 0.004))
    vyaw = e.movementX * 0.0018
    vpitch = e.movementY * 0.0012
  })
  const endDrag = () => {
    dragging = false
    hero.classList.remove('is-dragging')
  }
  hero.addEventListener('pointerup', endDrag)
  hero.addEventListener('pointercancel', endDrag)

  // a resize mid-flight would leave stale homes — just land the plane
  window.addEventListener('resize', () => {
    if (phase !== 'off') stop()
  })
}
