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

  let mode: 'ml' | 'agent' = 'ml'

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
  // agent-mode geometry
  let ax = 0 // llm box centre x
  let llmW = 0
  let llmH = 0
  let llmY = 0
  let toolX = 0
  let toolW = 0
  let toolH = 0
  let toolYs: number[] = []
  let harness = { x0: 0, y0: 0, x1: 0, y1: 0 }

  const layout = () => {
    cx = w * 0.56
    gateY = h * 0.26
    gateHalf = w * 0.09
    embedTop = h * 0.32
    modelTop = h * 0.58
    modelBot = h * 0.68
    modelW = w * 0.42
    cols = [-2, -1, 0, 1, 2].map((i) => cx + i * w * 0.085)

    ax = cx - w * 0.12
    llmW = w * 0.28
    llmH = h * 0.085
    llmY = h * 0.42
    toolX = cx + w * 0.26
    toolW = w * 0.27
    toolH = h * 0.058
    toolYs = [h * 0.3, h * 0.42, h * 0.54]
    harness = {
      x0: ax - llmW / 2 - w * 0.055,
      y0: h * 0.22,
      x1: toolX + toolW / 2 + w * 0.035,
      y1: h * 0.64,
    }
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

  // ---- pointer: the cursor feeds the pipeline ----
  // ---- agent mode: task → LLM harness loop over tools → answer ----
  interface AgentP {
    phase: 'task' | 'think' | 'toTool' | 'back' | 'answer'
    x: number
    y: number
    t: number
    tool: number
    loops: number
    seed: number
  }

  const agents: AgentP[] = []
  let llmPulse = 0
  const toolFlash = [0, 0, 0]
  let taskClock = 0
  let hoveredTool = -1
  let hoverLLM = false
  const pings: Array<{ x: number; y: number; t: number }> = []

  const spawnTask = (x?: number, y?: number) => {
    agents.push({
      phase: 'task',
      x: x ?? ax + (Math.random() - 0.5) * w * 0.3,
      y: y ?? -6,
      t: 0,
      tool: 0,
      loops: 2 + Math.floor(Math.random() * 2),
      seed: Math.random() * Math.PI * 2,
    })
  }

  const qp = (
    x0: number, y0: number, qx: number, qy: number, x1: number, y1: number, t: number,
  ) => {
    const u = 1 - t
    return {
      x: u * u * x0 + 2 * u * t * qx + t * t * x1,
      y: u * u * y0 + 2 * u * t * qy + t * t * y1,
    }
  }

  const toolPort = (i: number) => ({ x: toolX - toolW / 2, y: toolYs[i] })
  const llmPort = () => ({ x: ax + llmW / 2, y: llmY })

  const agentStep = (dt: number) => {
    taskClock += dt
    if (agents.length < 5 && taskClock > 2.1) {
      taskClock = 0
      spawnTask()
    }
    llmPulse = Math.max(0, llmPulse - dt * 2)
    for (let i = 0; i < 3; i++) toolFlash[i] = Math.max(0, toolFlash[i] - dt * 2.4)

    for (let i = pings.length - 1; i >= 0; i--) {
      pings[i].t += dt * 2.4
      if (pings[i].t >= 1) pings.splice(i, 1)
    }

    for (let i = agents.length - 1; i >= 0; i--) {
      const a = agents[i]
      switch (a.phase) {
        case 'task': {
          a.y += h * 0.1 * dt
          a.x += (ax - a.x) * dt * 2.2
          a.x += Math.sin(a.seed + a.y * 0.05) * 0.4
          if (a.y >= llmY - llmH / 2 - 3) {
            a.phase = 'think'
            a.t = 0.42
            llmPulse = 1
          }
          break
        }
        case 'think': {
          a.t -= dt
          if (a.t <= 0) {
            if (a.loops > 0) {
              a.loops--
              // a hovered tool captures the routing — the visitor steers the loop
              a.tool = hoveredTool >= 0 ? hoveredTool : Math.floor(Math.random() * 3)
              a.phase = 'toTool'
              a.t = 0
            } else {
              a.phase = 'answer'
              a.x = ax
              a.y = llmY + llmH / 2 + 3
            }
          }
          break
        }
        case 'toTool': {
          a.t += dt / 0.5
          const p0 = llmPort()
          const p1 = toolPort(a.tool)
          const pos = qp(
            p0.x, p0.y,
            (p0.x + p1.x) / 2, Math.min(p0.y, p1.y) - h * 0.045,
            p1.x, p1.y, Math.min(1, a.t),
          )
          a.x = pos.x
          a.y = pos.y
          if (a.t >= 1) {
            toolFlash[a.tool] = 1
            a.phase = 'back'
            a.t = 0
          }
          break
        }
        case 'back': {
          a.t += dt / 0.5
          const p0 = toolPort(a.tool)
          const p1 = llmPort()
          const pos = qp(
            p0.x, p0.y,
            (p0.x + p1.x) / 2, Math.max(p0.y, p1.y) + h * 0.045,
            p1.x, p1.y, Math.min(1, a.t),
          )
          a.x = pos.x
          a.y = pos.y
          if (a.t >= 1) {
            a.phase = 'think'
            a.t = 0.3
            llmPulse = 0.7
          }
          break
        }
        case 'answer': {
          a.y += h * 0.12 * dt
          if (a.y >= h * 0.97) agents.splice(i, 1)
          break
        }
      }
    }
  }

  const agentStructure = (now: number) => {
    ctx.lineWidth = 1

    // the harness: dashed boundary around agent + tools
    ctx.strokeStyle = css(ink, 0.32)
    ctx.setLineDash([4, 5])
    ctx.strokeRect(harness.x0, harness.y0, harness.x1 - harness.x0, harness.y1 - harness.y0)
    ctx.setLineDash([])

    // faint connectors llm ↔ tools
    ctx.strokeStyle = css(ink, 0.1)
    ctx.beginPath()
    for (let i = 0; i < 3; i++) {
      ctx.moveTo(ax + llmW / 2, llmY)
      ctx.lineTo(toolX - toolW / 2, toolYs[i])
    }
    ctx.stroke()

    // llm box
    ctx.strokeStyle = css(ink, 0.6)
    ctx.strokeRect(ax - llmW / 2, llmY - llmH / 2, llmW, llmH)
    ctx.fillStyle = css(ink, 0.55)
    ctx.font = '11px "IBM Plex Mono", monospace'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText('LLM', ax, llmY + 0.5)
    if (llmPulse > 0) {
      const g = 9 * (1 - llmPulse)
      ctx.strokeStyle = css(accent, llmPulse * 0.8)
      ctx.strokeRect(ax - llmW / 2 - g, llmY - llmH / 2 - g, llmW + g * 2, llmH + g * 2)
    }

    // tool rack
    const names = ['TOOLS', 'MCP', 'SKILLS']
    ctx.font = '8px "IBM Plex Mono", monospace'
    for (let i = 0; i < 3; i++) {
      const hot = i === hoveredTool
      ctx.strokeStyle = hot ? css(accent, 0.75) : css(ink, 0.45)
      ctx.strokeRect(toolX - toolW / 2, toolYs[i] - toolH / 2, toolW, toolH)
      if (hot) {
        ctx.fillStyle = css(accent, 0.08)
        ctx.fillRect(toolX - toolW / 2, toolYs[i] - toolH / 2, toolW, toolH)
      }
      ctx.fillStyle = hot ? css(accent, 0.9) : css(ink, 0.5)
      ctx.fillText(names[i], toolX, toolYs[i] + 0.5)
      if (toolFlash[i] > 0) {
        const g = 6 * (1 - toolFlash[i])
        ctx.strokeStyle = css(accent, toolFlash[i] * 0.85)
        ctx.strokeRect(
          toolX - toolW / 2 - g, toolYs[i] - toolH / 2 - g,
          toolW + g * 2, toolH + g * 2,
        )
      }
    }

    // hovering the LLM keeps it charged
    if (hoverLLM) {
      ctx.strokeStyle = css(accent, 0.45)
      ctx.strokeRect(ax - llmW / 2 - 3, llmY - llmH / 2 - 3, llmW + 6, llmH + 6)
    }

    // feed pings: a ring blooms where the visitor sows a task
    for (const p of pings) {
      ctx.strokeStyle = css(accent, (1 - p.t) * 0.55)
      ctx.beginPath()
      ctx.arc(p.x, p.y, 3 + p.t * 20, 0, Math.PI * 2)
      ctx.stroke()
    }

    // output line
    ctx.strokeStyle = css(ink, 0.18)
    ctx.beginPath()
    ctx.moveTo(ax, harness.y1 + 6)
    ctx.lineTo(ax, h * 0.97)
    ctx.stroke()

    void now
  }

  const agentParticles = (now: number) => {
    for (const a of agents) {
      switch (a.phase) {
        case 'task': {
          ctx.fillStyle = css(ink, 0.85)
          ctx.save()
          ctx.translate(a.x, a.y)
          ctx.rotate(a.seed + now * 0.0016)
          ctx.fillRect(-1.9, -1.3, 3.8, 2.6)
          ctx.restore()
          break
        }
        case 'toTool':
        case 'back': {
          ctx.fillStyle = css(a.phase === 'toTool' ? ink : accent, 0.9)
          ctx.save()
          ctx.translate(a.x, a.y)
          ctx.rotate(now * 0.004)
          ctx.fillRect(-1.8, -1.8, 3.6, 3.6)
          ctx.restore()
          break
        }
        case 'answer': {
          ctx.fillStyle = css(accent, 0.14)
          ctx.beginPath()
          ctx.arc(a.x, a.y, 7, 0, Math.PI * 2)
          ctx.fill()
          ctx.strokeStyle = css(accent, 0.3)
          ctx.beginPath()
          ctx.moveTo(a.x, a.y - 13)
          ctx.lineTo(a.x, a.y - 4)
          ctx.stroke()
          ctx.fillStyle = css(accent, 1)
          ctx.beginPath()
          ctx.arc(a.x, a.y, 2.3, 0, Math.PI * 2)
          ctx.fill()
          break
        }
        case 'think':
          break
      }
    }
  }

  let px = -1000
  let py = -1000
  let pointerIn = false
  let lastFeedX = 0
  let lastFeedY = 0
  let feedClock = 0

  const feed = () => {
    if (mode === 'agent') {
      if (agents.length < 12) {
        spawnTask(px, Math.min(py, h * 0.16))
        pings.push({ x: px, y: py, t: 0 })
      }
      return
    }
    if (parts.length > 130) return
    const jx = px + (Math.random() - 0.5) * 14
    if (py < gateY - 12) {
      // raw zone: drop noisy data right at the cursor
      const p = {
        phase: 'raw' as Phase,
        x: jx,
        y: py,
        xt:
          Math.random() > 0.16
            ? cx + (Math.random() - 0.5) * gateHalf * 1.7
            : cx + (Math.random() < 0.5 ? -1 : 1) * (gateHalf + 8 + Math.random() * w * 0.14),
        col: 0,
        seed: Math.random() * Math.PI * 2,
        size: 1.6 + Math.random() * 0.9,
        alpha: 0.85,
        t: 0,
      }
      parts.push(p)
    } else if (py < modelTop - 10) {
      // embedding zone: data joins the nearest dimension
      let best = 0
      for (let c = 1; c < cols.length; c++) {
        if (Math.abs(cols[c] - jx) < Math.abs(cols[best] - jx)) best = c
      }
      parts.push({
        phase: 'embed',
        x: jx,
        y: Math.max(py, gateY + 6),
        xt: jx,
        col: best,
        seed: Math.random() * Math.PI * 2,
        size: 1.9,
        alpha: 0.9,
        t: 0,
      })
    } else if (py < modelBot + 10) {
      // straight into the model
      parts.push({
        phase: 'model',
        x: jx,
        y: py,
        xt: jx,
        col: 0,
        seed: Math.random() * Math.PI * 2,
        size: 2,
        alpha: 0.9,
        t: 0,
      })
    }
  }

  const stageAt = (x: number, y: number): number => {
    if (mode === 'agent') {
      if (y < harness.y0 * 0.85) return 0
      if (y < harness.y0) return 1
      if (y < harness.y1) return x > cx + w * 0.06 ? 3 : 2
      return 4
    }
    return y < gateY ? 0 : y < embedTop ? 1 : y < modelTop ? 2 : y < modelBot ? 3 : 4
  }

  const labels = Array.from(
    host.querySelectorAll<HTMLElement>('.pipeline-labels li'),
  )

  const highlight = (idx: number) => {
    labels.forEach((l, i) => l.classList.toggle('is-active', i === idx))
  }

  const step = (dt: number, now: number) => {
    // population control
    const rawCount = parts.filter((p) => p.phase === 'raw').length
    if (rawCount < 16 && Math.random() < dt * 14) spawnRaw()

    // cursor feeding: sow while the pointer moves
    feedClock += dt
    if (pointerIn && feedClock > 0.07) {
      const moved = Math.hypot(px - lastFeedX, py - lastFeedY)
      if (moved > 5) {
        feedClock = 0
        lastFeedX = px
        lastFeedY = py
        feed()
      }
    }

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

      // particles shy away from the cursor
      if (pointerIn && (p.phase === 'raw' || p.phase === 'embed')) {
        const dx = p.x - px
        const dy = p.y - py
        const d2 = dx * dx + dy * dy
        if (d2 < 1600 && d2 > 0.01) {
          const d = Math.sqrt(d2)
          const f = ((40 - d) / 40) * 90 * dt
          p.x += (dx / d) * f
          p.y += (dy / d) * f * 0.35
        }
      }

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

  /** Each stage refines the data — and its shape:
   *  raw/reject: irregular tumbling specks · embed: squares aligning to the
   *  grid · model: squares spinning in · out/fly: clean glowing pulses. */
  const drawParticles = (now: number) => {
    for (const p of parts) {
      switch (p.phase) {
        case 'raw':
        case 'reject': {
          ctx.fillStyle = css(p.phase === 'reject' ? accent : ink, Math.min(1, p.alpha))
          ctx.save()
          ctx.translate(p.x, p.y)
          ctx.rotate(p.seed + now * 0.0016)
          const s = p.size
          ctx.fillRect(-s, -s * 0.7, s * 2, s * 1.4)
          ctx.restore()
          break
        }
        case 'embed': {
          // rotation settles to 0 as the point locks onto its dimension
          const off = Math.min(1, Math.abs(p.x - cols[p.col]) / 24)
          ctx.fillStyle = css(ink, 0.9)
          ctx.save()
          ctx.translate(p.x, p.y)
          ctx.rotate((p.seed + now * 0.0016) * off)
          const s = p.size + 0.5
          ctx.fillRect(-s, -s, s * 2, s * 2)
          ctx.restore()
          break
        }
        case 'model': {
          ctx.fillStyle = css(ink, 0.9)
          ctx.save()
          ctx.translate(p.x, p.y)
          ctx.rotate(now * 0.008 + p.seed)
          const s = Math.max(0.5, p.size)
          ctx.fillRect(-s, -s, s * 2, s * 2)
          ctx.restore()
          break
        }
        case 'out':
        case 'fly': {
          // halo + trail: refined signal
          ctx.fillStyle = css(accent, 0.14)
          ctx.beginPath()
          ctx.arc(p.x, p.y, p.size * 3, 0, Math.PI * 2)
          ctx.fill()
          if (p.phase === 'out') {
            ctx.strokeStyle = css(accent, 0.3)
            ctx.beginPath()
            ctx.moveTo(p.x, p.y - 13)
            ctx.lineTo(p.x, p.y - 4)
            ctx.stroke()
          }
          ctx.fillStyle = css(accent, 1)
          ctx.beginPath()
          ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2)
          ctx.fill()
          break
        }
      }
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
    if (mode === 'agent') {
      agentStep(dt)
      agentStructure(now)
      agentParticles(now)
    } else {
      step(dt, now)
      drawStructure(now)
      drawParticles(now)
    }
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
    if (mode === 'agent') {
      agentStructure(0)
      return
    }
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

  // ---- mode tabs: ML PIPELINE ⇄ LLM AGENT ----
  const LABEL_SETS: Record<'ml' | 'agent', Array<[number, string, string]>> = {
    ml: [
      [5, '01', 'RAW DATA'],
      [23, '02', 'PREPROCESS'],
      [40, '03', 'EMBEDDINGS'],
      [60, '04', 'MODEL'],
      [84, '05', 'DEPLOY'],
    ],
    agent: [
      [5, '01', 'TASK'],
      [17, '02', 'HARNESS'],
      [40, '03', 'AGENT LOOP'],
      [57, '04', 'TOOLS · MCP'],
      [84, '05', 'OUTPUT'],
    ],
  }
  const CAPTIONS = {
    ml: 'DATA FLYWHEEL — 弾み車',
    agent: 'AGENT HARNESS — エージェント',
  }
  const captionEl = host.querySelector<HTMLElement>('.pipeline-caption')
  const tabs = Array.from(host.querySelectorAll<HTMLElement>('.pipeline-tab'))

  const setMode = (m: 'ml' | 'agent') => {
    if (m === mode) return
    mode = m
    tabs.forEach((b) => b.classList.toggle('is-on', b.dataset.pmode === m))
    LABEL_SETS[m].forEach(([top, n, txt], i) => {
      const li = labels[i]
      if (!li) return
      li.style.top = `${top}%`
      li.innerHTML = `<sup>${n}</sup> ${txt}`
    })
    if (captionEl) captionEl.textContent = CAPTIONS[m]
    highlight(-1)
    if (m === 'agent' && agents.length === 0) {
      spawnTask(undefined, h * 0.08)
      spawnTask(undefined, h * 0.24)
    }
    if (reduced) staticFrame()
  }

  tabs.forEach((b) =>
    b.addEventListener('click', () => setMode(b.dataset.pmode as 'ml' | 'agent')),
  )

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

  // pointer: feed the flywheel, light the stage label
  host.addEventListener('pointermove', (e) => {
    const r = canvas.getBoundingClientRect()
    px = e.clientX - r.left
    py = e.clientY - r.top
    pointerIn = true
    highlight(stageAt(px, py))

    // agent mode: hovering a tool routes the loop through it
    hoveredTool = -1
    hoverLLM = false
    if (mode === 'agent') {
      if (Math.abs(px - toolX) < toolW / 2 + 6) {
        for (let i = 0; i < 3; i++) {
          if (Math.abs(py - toolYs[i]) < toolH / 2 + 6) hoveredTool = i
        }
      }
      hoverLLM =
        Math.abs(px - ax) < llmW / 2 + 6 && Math.abs(py - llmY) < llmH / 2 + 6
    }
  })

  host.addEventListener('pointerleave', () => {
    pointerIn = false
    px = -1000
    py = -1000
    hoveredTool = -1
    hoverLLM = false
    highlight(-1)
  })
}
