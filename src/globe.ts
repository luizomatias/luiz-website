/** Contact globe: a halftone dotted Earth that spins into view, settles on
 *  Belo Horizonte, pushes in, and blooms a radar marker. Drag to spin it —
 *  released, it always eases back home. Canvas 2D orthographic projection,
 *  no deps; landmass is a 180×90 bitmask baked from a public-domain
 *  equirectangular map (Wikimedia "World location map").
 */

// 180×90 land bitmask (2° cells), base64 of row-major bits, N→S from lat 90°
const LAND_B64 =
  'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAsABgAAAAAAAAAAAAAAAAAAAAAAAAA/vz//wAAAAAAAAAAAAAAAAAAAAAAAPPw//8PAIAAAAAAAAAAAAAAAAAAAAAAA/7/fwAAAAAAAABgAAAAAAAAAAAAADUA/v8HAAAAAAgA/H8AAAAAAAAA8ABJA4D/HwAAAAAAAPj/PwMAAAAAAADww/wD4P8EAAAAAAL7//9//xMAAP+/f38Y8QD+PwAA4AMA8v//////P//x/////x884D8AAMD/0///////////jP//n/+/4AE+AAcAn8f//////////w/g/////wEY4AEAAPj+//////////9/AP////8HeAAcAADg5///////////9QDAAfr/f4AnAAAAAHb8////////H8QAAAAA//8P8AcAAIAB4/////////8ABwAAAOD//4//AAAAEAD+////////A3AAAAAA/P//+T8AAEDD//////////8BAwAAAID/////AwAAIP//////////PwAAAAAA4P///2EAAAD8//////////8AAAAAAAD///E/AAAA4P///f//////BwAAAAAA8P9//AMAAAD8/OFz/v///38AAAAAAAD///sHAAAA/JAPOP//////IQAAAAAA8P//HwAAAMAHMv7n/////wcAAAAAAAD+//8AAAAAPADyf/7///8hEAAAAAAA4P//DwAAAIABAP/v////P4YBAAAAAAD8//8AAAAA+A8A//////8DDAAAAAAAAP//AwAAAMD/APD/////PwAAAAAAAADQ/z8AAAAA/n////////8HAAAAAAAAAPwDAgAAAOD////z////fwAAAAAAAACAHyAAAACA//9/f/7///8DAAAAAAAAAPABAAAAAPj//+8P8P//PwAAAAAAAAAAHgAAAADA/////A/+9/8AAAAAAAAAAMBjCAAAAPz//9//oD//AAAAAAAAAAAAPAIAAADA////+Qf44QcAAAAAAAAAAAA/AAAAAPz//78fgAf8QAAAAAAAAAAAAA8AAADA////8wA4gB8AAAAAAAAAAADAAAAAAPz//38BAAPwAQAAAAAAAAAAAAAKAACA////zwAwAAwAAAAAAAAAAAAA8AcAAPD///8HAAEAAAAAAAAAAAAAAID/AQAA////fwBAAAAQAAAAAAAAAAAA+P8AAMDi//8DAAAwEAAAAAAAAAAAAID/HwAAAPj/HwAAgIIBAAAAAAAAAAAA+P8BAACA//8AAAAQHgAAAAAAAAAAAMD/bwAAAPi/BwAAAOMBAQAAAAAAAAAA/P8/AACA/z8AAABgTMABAAAAAAAAAMD//w8AAPD/AwAAAAQAfAAAAAAAAAAA/P//AQAA/j8AAAAAAoAPAAAAAAAAAID//w8AAOD/AwAAAAAAgAAAAAAAAAAA+P//AAAA/j8AAAAAAAAAAAAAAAAAAAD//wcAAOD/AwAAAACAIwAAAAAAAAAA8P9/AAAA/z8EAAAAADoCAAAAAAAAAAD8/wcAAPD/cwAAAADwZwAAAAAAAAAAgP8/AAAA/w8HAAAAgP8HAAAAAAAAAAD4/wMAAOD/MAAAAAD+/wEAAAAAAAAAgP8fAAAA/g8DAAAA+P8fAAAAAAAAAAD4PwAAAMB/MAAAAID//wMAAAAAAAAAgP8DAAAA/AMAAAAA+P9/AAAAAAAAAAD4PwAAAMA/AAAAAID//wcAAAAAAAAAwP8AAAAA+AEAAAAA8P9/AAAAAAAAAAD8DwAAAIAPAAAAAAAf/gMAAAAAAAAAwH8AAAAAAAAAAAAAMIAfAAAAAAAAAAD8AwAAAAAAAAAAAAAA8AEAAAAAAAAA4B8AAAAAAAAAAAAAAAAAAAYAAAAAAAB+AAAAAAAAAAAAAAAAAAAAAAAAAAAAwAMAAAAAAAAAAAAAAAAIgAEAAAAAAAAcAAAAAAAAAAAAAAAAAAAMAAAAAAAA4AEAAAAAAAAAAAAAAAAAAAAAAAAAAAAeAAAAAAAAAAAAAAAAAAAAAAAAAAAAwAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAIAAAAAAAA4AMD/z/kBAAAAAAAAAAAgAAAAAAAA/P/h/////wEAAAAAAAAAwAcAAADw////z///////DwAAAAAAAAB4AAAA//////////////8HAACA/wP//wcAAPz/////////////DwAA4P///38AAID//////////////38AAOD/////AQAO/v//////////////BwAA4P////8HAOD//////////////z8AAMD/////////////////////////HwAA/P//////////////////////////////////////////////////////////////////////////////////////'

const GW = 180
const GH = 90
const DEG = Math.PI / 180

// home: Belo Horizonte
const BH_LAT = -19.9167
const BH_LNG = -43.9345

const easeOut = (t: number) => 1 - Math.pow(1 - t, 3)
const clamp01 = (v: number) => Math.min(1, Math.max(0, v))

function landTest(): (lat: number, lng: number) => boolean {
  const bin = atob(LAND_B64)
  const bits = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) bits[i] = bin.charCodeAt(i)
  return (lat, lng) => {
    const gx = Math.min(GW - 1, Math.floor(((lng + 180) / 360) * GW))
    const gy = Math.min(GH - 1, Math.floor(((90 - lat) / 180) * GH))
    const i = gy * GW + gx
    return (bits[i >> 3] >> (i & 7) & 1) === 1
  }
}

export function initGlobe(): void {
  const wrap = document.querySelector<HTMLElement>('.globe')
  const canvas = document.querySelector<HTMLCanvasElement>('.globe-canvas')
  if (!wrap || !canvas) return
  const ctx = canvas.getContext('2d')
  if (!ctx) return

  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches

  // ---- dot lattice: fibonacci sphere, keep land points ---------------------
  const isLand = landTest()
  const dots: Array<{ sinP: number; cosP: number; lng: number }> = []
  const N = 5600
  const GA = Math.PI * (3 - Math.sqrt(5))
  for (let i = 0; i < N; i++) {
    const y = 1 - (i / (N - 1)) * 2
    const lat = Math.asin(y) / DEG
    const lng = ((((i * GA) / DEG) % 360) + 540) % 360 - 180
    if (!isLand(lat, lng)) continue
    dots.push({ sinP: Math.sin(lat * DEG), cosP: Math.cos(lat * DEG), lng: lng * DEG })
  }

  // ---- state ----------------------------------------------------------------
  let dpr = 1
  let size = 0
  let lat0 = BH_LAT * DEG
  let lng0 = BH_LNG * DEG
  let zoom = 1.45
  let started = false
  let t0 = 0
  let raf = 0
  let visible = false
  let dragging = false
  let returning = 0 // returns-home animation start time
  let retFrom = { lat: 0, lng: 0 }

  const css = (name: string) =>
    getComputedStyle(document.documentElement).getPropertyValue(name).trim()

  const resize = () => {
    dpr = Math.min(window.devicePixelRatio || 1, 2)
    size = Math.min(wrap.offsetWidth, 460)
    canvas.width = size * dpr
    canvas.height = size * dpr
    canvas.style.width = `${size}px`
    canvas.style.height = `${size}px`
  }

  // shortest angular path (so the return spin doesn't take the long way round)
  const angleTo = (from: number, to: number) => {
    let d = (to - from) % (Math.PI * 2)
    if (d > Math.PI) d -= Math.PI * 2
    if (d < -Math.PI) d += Math.PI * 2
    return d
  }

  let lastDraw = 0

  const draw = (now: number) => {
    const t = (now - t0) / 1000
    const dt = Math.min(3, (now - (lastDraw || now)) / 16.7)
    lastDraw = now
    const R = size * 0.42

    // ---- cinematic timeline -----------------------------------------------
    const approaching = !reduced && !dragging && !returning && t < 2.6
    if (approaching) {
      // approach: spin in from the far side, level out onto BH's latitude
      const k = easeOut(t / 2.6)
      lng0 = (BH_LNG + 140 * (1 - k)) * DEG
      lat0 = (10 + (BH_LAT - 10) * k) * DEG
      zoom = 0.85 + 0.15 * k
    } else if (!reduced) {
      // zoom is a spring: grabbing pulls the camera out to show the whole
      // planet, letting go pushes back in over BH
      const target = dragging ? 0.92 : 1.45
      zoom += (target - zoom) * Math.min(1, 0.07 * dt)
      if (!dragging && !returning) {
        // idle breath
        lng0 = BH_LNG * DEG + Math.sin(now * 0.00022) * 1.6 * DEG
        lat0 = BH_LAT * DEG + Math.cos(now * 0.00017) * 0.9 * DEG
      }
    }
    if (returning) {
      const k = easeOut(clamp01((now - returning) / 1100))
      lat0 = retFrom.lat + (BH_LAT * DEG - retFrom.lat) * k
      lng0 = retFrom.lng + angleTo(retFrom.lng, BH_LNG * DEG) * k
      if (k >= 1) {
        returning = 0
        t0 = now - 3800 // resume idle breath past the timeline
      }
    }

    const ink = css('--ink') || '#1d1d1f'
    const soft = css('--ink-soft') || '#6e6e73'
    const accent = css('--accent') || '#0071e3'

    ctx.clearRect(0, 0, canvas.width, canvas.height)
    ctx.save()
    ctx.scale(dpr, dpr)
    const cx = size / 2
    const cy = size / 2
    const r = R * zoom

    // rim
    ctx.globalAlpha = 0.45
    ctx.strokeStyle = soft
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.arc(cx, cy, r, 0, Math.PI * 2)
    ctx.stroke()

    // dots (orthographic)
    const sin0 = Math.sin(lat0)
    const cos0 = Math.cos(lat0)
    ctx.fillStyle = ink
    for (const d of dots) {
      const dl = d.lng - lng0
      const cosDl = Math.cos(dl)
      const cosc = sin0 * d.sinP + cos0 * d.cosP * cosDl
      if (cosc <= 0.02) continue
      const x = cx + d.cosP * Math.sin(dl) * r
      const y = cy - (cos0 * d.sinP - sin0 * d.cosP * cosDl) * r
      const s = (0.9 + 1.1 * cosc) * (size / 420)
      ctx.globalAlpha = 0.2 + 0.68 * cosc
      ctx.fillRect(x - s / 2, y - s / 2, s, s)
    }

    // ---- BH marker + callout ------------------------------------------------
    const mk = (() => {
      const dl = BH_LNG * DEG - lng0
      const cosDl = Math.cos(dl)
      const sinP = Math.sin(BH_LAT * DEG)
      const cosP = Math.cos(BH_LAT * DEG)
      const cosc = sin0 * sinP + cos0 * cosP * cosDl
      return {
        cosc,
        x: cx + cosP * Math.sin(dl) * r,
        y: cy - (cos0 * sinP - sin0 * cosP * cosDl) * r,
      }
    })()
    const markerIn = reduced ? 1 : clamp01((t - 2.4) / 0.8)

    if (mk.cosc > 0.15 && markerIn > 0) {
      const a = markerIn * clamp01((mk.cosc - 0.15) / 0.3)

      // radar rings
      if (!reduced) {
        const ring = ((now / 1900) % 1) * 26
        ctx.globalAlpha = a * 0.5 * (1 - ring / 26)
        ctx.strokeStyle = accent
        ctx.lineWidth = 1.2
        ctx.beginPath()
        ctx.arc(mk.x, mk.y, 3 + ring, 0, Math.PI * 2)
        ctx.stroke()
      }

      // core dot + fine cross
      ctx.globalAlpha = a
      ctx.fillStyle = accent
      ctx.beginPath()
      ctx.arc(mk.x, mk.y, 3.2, 0, Math.PI * 2)
      ctx.fill()
      ctx.strokeStyle = accent
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.moveTo(mk.x - 9, mk.y)
      ctx.lineTo(mk.x - 4, mk.y)
      ctx.moveTo(mk.x + 4, mk.y)
      ctx.lineTo(mk.x + 9, mk.y)
      ctx.moveTo(mk.x, mk.y - 9)
      ctx.lineTo(mk.x, mk.y - 4)
      ctx.moveTo(mk.x, mk.y + 4)
      ctx.lineTo(mk.x, mk.y + 9)
      ctx.stroke()

      // callout — side elbow when there's room, centred underneath when not
      const name = 'BELO HORIZONTE — BR'
      const coords = '19.92° S · 43.94° W'
      ctx.font = '600 11px "IBM Plex Mono", monospace'
      const tw = ctx.measureText(name).width
      const fitsRight = mk.x + 26 + 36 + tw < size - 8
      const fitsLeft = mk.x - 26 - 36 - tw > 8

      if (fitsRight || fitsLeft) {
        const dir = fitsRight ? 1 : -1
        const ex = mk.x + 26 * dir
        const ey = mk.y - 26
        ctx.globalAlpha = a * 0.8
        ctx.beginPath()
        ctx.moveTo(mk.x + 6 * dir, mk.y - 6)
        ctx.lineTo(ex, ey)
        ctx.lineTo(ex + 30 * dir, ey)
        ctx.stroke()
        ctx.textAlign = fitsRight ? 'left' : 'right'
        ctx.globalAlpha = a
        ctx.fillStyle = ink
        ctx.fillText(name, ex + 36 * dir, ey - 2)
        ctx.globalAlpha = a * 0.75
        ctx.font = '10px "IBM Plex Mono", monospace'
        ctx.fillStyle = soft
        ctx.fillText(coords, ex + 36 * dir, ey + 11)
      } else {
        ctx.globalAlpha = a * 0.8
        ctx.beginPath()
        ctx.moveTo(mk.x, mk.y + 12)
        ctx.lineTo(mk.x, mk.y + 30)
        ctx.stroke()
        ctx.textAlign = 'center'
        ctx.globalAlpha = a
        ctx.fillStyle = ink
        ctx.fillText(name, mk.x, mk.y + 44)
        ctx.globalAlpha = a * 0.75
        ctx.font = '10px "IBM Plex Mono", monospace'
        ctx.fillStyle = soft
        ctx.fillText(coords, mk.x, mk.y + 57)
      }
      ctx.textAlign = 'left'
    }

    ctx.restore()
  }

  const loop = (now: number) => {
    draw(now)
    if (visible && !reduced) raf = requestAnimationFrame(loop)
  }

  // ---- drag to spin; let go and it comes home -------------------------------
  if (!reduced) {
    canvas.addEventListener('pointerdown', (e) => {
      if (!started) return
      dragging = true
      returning = 0
      canvas.setPointerCapture(e.pointerId)
      wrap.classList.add('is-dragging')
    })
    canvas.addEventListener('pointermove', (e) => {
      if (!dragging) return
      lng0 -= (e.movementX * 0.55 * DEG) / zoom
      lat0 += (e.movementY * 0.45 * DEG) / zoom
      lat0 = Math.max(-72 * DEG, Math.min(72 * DEG, lat0))
    })
    const release = () => {
      if (!dragging) return
      dragging = false
      wrap.classList.remove('is-dragging')
      retFrom = { lat: lat0, lng: lng0 }
      returning = performance.now()
    }
    canvas.addEventListener('pointerup', release)
    canvas.addEventListener('pointercancel', release)
  }

  // ---- visibility drives everything -----------------------------------------
  resize()
  window.addEventListener('resize', () => {
    resize()
    if (reduced && started) draw(performance.now())
  })

  const io = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        visible = entry.isIntersecting
        if (visible && !started) {
          started = true
          t0 = performance.now()
          if (reduced) {
            draw(performance.now()) // single static frame, already home
            return
          }
        }
        if (visible && !reduced) {
          cancelAnimationFrame(raf)
          raf = requestAnimationFrame(loop)
        }
      }
    },
    { threshold: 0.2 },
  )
  io.observe(wrap)
}
