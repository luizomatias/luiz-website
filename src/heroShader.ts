/** Hero shader background — a slow, domain-warped gradient flow that lives
 *  behind the name. It reads its palette straight from the CSS custom
 *  properties (--paper-deep / --ink / --accent), so it tracks both the
 *  light/dark theme and the IRL⇄anime world for free. In the real world it
 *  is a slow grey smoke — ink only, no accent; in the anime world the
 *  accent bleeds through like ink in water and the flow quickens. Kept deliberately quiet
 *  so the type stays readable — it is ambience, not a light show. */
export function initHeroShader(): void {
  const canvas = document.querySelector<HTMLCanvasElement>('.hero-shader')
  const hero = document.querySelector<HTMLElement>('.hero')
  if (!canvas || !hero) return

  const gl = canvas.getContext('webgl', { antialias: false, alpha: true })
  if (!gl) return // no WebGL → the CSS .hero-glow stays as the fallback

  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches

  const vert = `
    attribute vec2 aPos;
    void main() { gl_Position = vec4(aPos, 0.0, 1.0); }
  `

  const frag = `
    precision highp float;
    uniform vec2 uRes;
    uniform float uTime;
    uniform float uMode;    // 0 = IRL, 1 = anime
    uniform float uStrength; // overall mix toward the smoke, set per theme+world
    uniform vec3 uPaper;
    uniform vec3 uInk;
    uniform vec3 uAccent;

    float hash(vec2 p) {
      p = fract(p * vec2(123.34, 345.45));
      p += dot(p, p + 34.345);
      return fract(p.x * p.y);
    }
    float noise(vec2 p) {
      vec2 i = floor(p), f = fract(p);
      float a = hash(i);
      float b = hash(i + vec2(1.0, 0.0));
      float c = hash(i + vec2(0.0, 1.0));
      float d = hash(i + vec2(1.0, 1.0));
      vec2 u = f * f * (3.0 - 2.0 * f);
      return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
    }
    float fbm(vec2 p) {
      float v = 0.0, amp = 0.5;
      for (int i = 0; i < 5; i++) { v += amp * noise(p); p *= 2.02; amp *= 0.5; }
      return v;
    }

    void main() {
      vec2 uv = gl_FragCoord.xy / uRes.xy;
      vec2 p = uv * vec2(uRes.x / uRes.y, 1.0) * 1.4;
      float t = uTime * (0.045 + 0.035 * uMode);

      // domain warp for that liquid, flowing feel
      vec2 q = vec2(fbm(p + vec2(0.0, t)), fbm(p + vec2(5.2, -t)));
      vec2 r = vec2(
        fbm(p + 2.0 * q + vec2(1.7, 9.2) + 0.5 * t),
        fbm(p + 2.0 * q + vec2(8.3, 2.8) - 0.5 * t)
      );
      float f = clamp(fbm(p + 2.4 * r) * 1.1, 0.0, 1.0);

      // paper → a touch of ink for depth
      vec3 col = mix(uPaper, mix(uPaper, uInk, 0.35), f);

      // accent veins — a whisper in IRL (the smoke stays grey), blooming in anime
      float accentAmt = smoothstep(0.45, 0.9, f) * (0.06 + 0.54 * uMode);
      col = mix(col, uAccent, accentAmt);

      // pull the whole thing back toward paper so it stays ambient;
      // the strength is decided on the CPU per theme+world
      col = mix(uPaper, col, uStrength);

      gl_FragColor = vec4(col, 1.0);
    }
  `

  const compile = (type: number, src: string): WebGLShader | null => {
    const s = gl.createShader(type)
    if (!s) return null
    gl.shaderSource(s, src)
    gl.compileShader(s)
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) return null
    return s
  }

  const vs = compile(gl.VERTEX_SHADER, vert)
  const fs = compile(gl.FRAGMENT_SHADER, frag)
  if (!vs || !fs) return

  const prog = gl.createProgram()
  if (!prog) return
  gl.attachShader(prog, vs)
  gl.attachShader(prog, fs)
  gl.linkProgram(prog)
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return
  gl.useProgram(prog)

  // fullscreen triangle
  const buf = gl.createBuffer()
  gl.bindBuffer(gl.ARRAY_BUFFER, buf)
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW)
  const aPos = gl.getAttribLocation(prog, 'aPos')
  gl.enableVertexAttribArray(aPos)
  gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0)

  const uRes = gl.getUniformLocation(prog, 'uRes')
  const uTime = gl.getUniformLocation(prog, 'uTime')
  const uMode = gl.getUniformLocation(prog, 'uMode')
  const uStrength = gl.getUniformLocation(prog, 'uStrength')
  const uPaper = gl.getUniformLocation(prog, 'uPaper')
  const uInk = gl.getUniformLocation(prog, 'uInk')
  const uAccent = gl.getUniformLocation(prog, 'uAccent')

  // ---- palette, read live from CSS so theme + world just work -------------
  const root = document.documentElement
  const parse = (v: string): [number, number, number] => {
    const m = v.match(/[\d.]+/g)
    if (!m || m.length < 3) return [0, 0, 0]
    return [+m[0] / 255, +m[1] / 255, +m[2] / 255]
  }
  const readVar = (name: string): [number, number, number] => {
    const cs = getComputedStyle(root)
    // resolve the var by writing it onto a probe: getComputedStyle returns rgb()
    probe.style.color = cs.getPropertyValue(name).trim() || '#000'
    return parse(getComputedStyle(probe).color)
  }
  const probe = document.createElement('span')
  probe.style.cssText = 'position:absolute;width:0;height:0;opacity:0;pointer-events:none'
  hero.appendChild(probe)

  type RGB = [number, number, number]
  const lerp = (a: number, b: number, t: number) => a + (b - a) * t
  const lerp3 = (a: RGB, b: RGB, t: number): RGB => [
    lerp(a[0], b[0], t),
    lerp(a[1], b[1], t),
    lerp(a[2], b[2], t),
  ]

  // base on --paper (the actual page background), NOT --paper-deep — otherwise
  // the shader's flat areas are darker than the page and the canvas reads as a
  // grey rectangle with a hard top edge
  let paper = readVar('--paper')
  let ink = readVar('--ink')
  let accent = readVar('--accent')
  let tgtPaper = paper
  let tgtInk = ink
  let tgtAccent = accent

  let mode = root.dataset.mode === 'anime' ? 1 : 0
  let tgtMode = mode

  // how far the smoke is allowed to depart from plain paper. Dark paper
  // shows the light wisps readily; light paper needs a stronger mix for
  // the grey to carry the same presence
  const strengthFor = () =>
    root.dataset.mode === 'anime' ? 0.62 : root.dataset.theme === 'dark' ? 0.48 : 0.92
  let strength = strengthFor()
  let tgtStrength = strength

  const refreshTargets = () => {
    tgtPaper = readVar('--paper')
    tgtInk = readVar('--ink')
    tgtAccent = readVar('--accent')
    tgtMode = root.dataset.mode === 'anime' ? 1 : 0
    tgtStrength = strengthFor()
  }

  new MutationObserver(() => {
    refreshTargets()
    if (reduced) drawStill()
  }).observe(root, { attributeFilter: ['data-mode', 'data-theme'] })

  // ---- sizing -------------------------------------------------------------
  let dpr = 1
  const resize = () => {
    dpr = Math.min(window.devicePixelRatio || 1, 1.75)
    const w = Math.max(1, Math.round(hero.clientWidth * dpr))
    const h = Math.max(1, Math.round(hero.clientHeight * dpr))
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w
      canvas.height = h
      gl.viewport(0, 0, w, h)
      // resizing wipes the drawing buffer — repaint the still frame when
      // no animation loop is around to do it on the next tick
      if (reduced) drawStill()
    }
  }
  new ResizeObserver(resize).observe(hero)

  const draw = (time: number) => {
    gl.uniform2f(uRes, canvas.width, canvas.height)
    gl.uniform1f(uTime, time)
    gl.uniform1f(uMode, mode)
    gl.uniform1f(uStrength, strength)
    gl.uniform3fv(uPaper, paper)
    gl.uniform3fv(uInk, ink)
    gl.uniform3fv(uAccent, accent)
    gl.drawArrays(gl.TRIANGLES, 0, 3)
  }

  /** reduced-motion path: snap to targets and paint a single still frame */
  const drawStill = () => {
    paper = tgtPaper
    ink = tgtInk
    accent = tgtAccent
    mode = tgtMode
    strength = tgtStrength
    draw(0)
  }

  const loop = (now: number) => {
    if (!onScreen) {
      running = false
      return
    }
    // ease palette + mode toward their targets for a smooth world switch
    mode = lerp(mode, tgtMode, 0.05)
    strength = lerp(strength, tgtStrength, 0.05)
    paper = lerp3(paper, tgtPaper, 0.06)
    ink = lerp3(ink, tgtInk, 0.06)
    accent = lerp3(accent, tgtAccent, 0.06)
    draw(now * 0.001)
    requestAnimationFrame(loop)
  }

  // single-flight guard: observers and init may all ask for the loop,
  // but only one rAF chain must ever run
  let running = false
  let onScreen = true
  const start = () => {
    if (running || reduced) return
    running = true
    requestAnimationFrame(loop)
  }

  // pause when the hero scrolls away
  new IntersectionObserver(
    (entries) => {
      onScreen = entries[0].isIntersecting
      if (onScreen) start()
    },
    { threshold: 0 }
  ).observe(hero)

  // if the OS reclaims the GPU context, get out of the way — the CSS
  // .hero-glow underneath keeps the hero alive
  canvas.addEventListener('webglcontextlost', (e) => {
    e.preventDefault()
    canvas.style.display = 'none'
  })
  canvas.addEventListener('webglcontextrestored', () => {
    canvas.style.display = ''
    resize()
    if (reduced) drawStill()
    else start()
  })

  refreshTargets()
  if (reduced) drawStill()
  else start()
}
