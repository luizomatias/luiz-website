import './style.css'
import { createLiquid, type LiquidInstance } from './components/canvasui/LiquidVanilla'

const root = document.documentElement
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches

function initTheme(): void {
  const button = document.querySelector<HTMLButtonElement>('#theme-toggle')
  const label = button?.querySelector<HTMLElement>('.theme-label')
  if (!button || !label) return

  const apply = (theme: 'light' | 'dark') => {
    root.dataset.theme = theme
    label.textContent = theme === 'dark' ? 'Light' : 'Dark'
    button.setAttribute('aria-label', `Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`)
    document.querySelector('meta[name="theme-color"]')?.setAttribute(
      'content',
      theme === 'dark' ? '#0b0b0c' : '#e9ff4f',
    )
    window.dispatchEvent(new CustomEvent('themechange', { detail: theme }))
  }

  apply(root.dataset.theme === 'dark' ? 'dark' : 'light')

  button.addEventListener('click', () => {
    const next = root.dataset.theme === 'dark' ? 'light' : 'dark'
    try {
      localStorage.setItem('theme', next)
    } catch {
      // Theme remains available for this session when storage is unavailable.
    }

    const update = () => apply(next)
    const documentWithTransitions = document as Document & {
      startViewTransition?: (callback: () => void) => void
    }
    if (!reduceMotion && documentWithTransitions.startViewTransition) {
      documentWithTransitions.startViewTransition(update)
    } else {
      update()
    }
  })
}

function initLiquid(): LiquidInstance | null {
  const source = document.querySelector<HTMLCanvasElement>('#liquid-source')
  const content = document.querySelector<HTMLElement>('#liquid-capture')
  const output = document.querySelector<HTMLCanvasElement>('#liquid-output')
  if (!source || !content || !output) return null

  const dark = root.dataset.theme === 'dark'
  const instance = createLiquid(
    { source, content, output },
    {
      simResolution: 128,
      dyeResolution: 512,
      densityDissipation: 0.988,
      velocityDissipation: 0.972,
      pressureIterations: 8,
      curl: 3.6,
      radius: 0.42,
      force: 1.2,
      intensity: 2.1,
      distortion: 0.58,
      blend: 7,
      color: dark ? [0.91, 1, 0.31] : [0.13, 0.18, 0.95],
    },
  )

  if (!instance) return null

  window.addEventListener('themechange', ((event: CustomEvent<'light' | 'dark'>) => {
    instance.setOptions({
      color: event.detail === 'dark' ? [0.91, 1, 0.31] : [0.13, 0.18, 0.95],
    })
  }) as EventListener)

  if (!reduceMotion) {
    window.setTimeout(() => {
      instance.splat(0.12, 0.08, 18, 96)
      instance.splat(0.34, 0.04, -12, 82)
      instance.splat(0.58, 0.07, 14, 90)
      instance.splat(0.82, 0.1, -9, 88)
    }, 500)

    const exhale = () => {
      if (!document.hidden) {
        const x = 0.12 + Math.random() * 0.76
        const drift = (Math.random() - 0.5) * 28
        const lift = 62 + Math.random() * 46
        instance.splat(x, 0.035 + Math.random() * 0.08, drift, lift)
        instance.splat(
          Math.min(0.94, Math.max(0.06, x + (Math.random() - 0.5) * 0.12)),
          0.02 + Math.random() * 0.05,
          drift * -0.45,
          lift * 0.72,
        )
      }
      window.setTimeout(exhale, 1500 + Math.random() * 1200)
    }

    window.setTimeout(exhale, 1200)
  }

  return instance
}

function initReveals(): void {
  const elements = document.querySelectorAll<HTMLElement>('.reveal')
  if (reduceMotion) {
    elements.forEach((element) => element.classList.add('is-visible'))
    return
  }

  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue
        entry.target.classList.add('is-visible')
        observer.unobserve(entry.target)
      }
    },
    { threshold: 0.12, rootMargin: '0px 0px -8% 0px' },
  )
  elements.forEach((element) => observer.observe(element))
}

function initHero(): void {
  const lines = document.querySelectorAll<HTMLElement>('[data-reveal-line]')
  lines.forEach((line, index) => {
    line.style.setProperty('--line-delay', `${160 + index * 90}ms`)
  })
  requestAnimationFrame(() => document.body.classList.add('is-ready'))
}

function initProgress(): void {
  let queued = false
  const update = () => {
    queued = false
    const max = root.scrollHeight - root.clientHeight
    root.style.setProperty('--scroll', `${max > 0 ? root.scrollTop / max : 0}`)
  }
  document.addEventListener(
    'scroll',
    () => {
      if (queued) return
      queued = true
      requestAnimationFrame(update)
    },
    { passive: true },
  )
  update()
}

function initMenu(): void {
  const button = document.querySelector<HTMLButtonElement>('#menu-toggle')
  const menu = document.querySelector<HTMLElement>('#site-nav-mobile')
  if (!button || !menu) return

  const close = () => {
    root.classList.remove('menu-open')
    button.setAttribute('aria-expanded', 'false')
    button.textContent = 'Menu'
  }

  button.addEventListener('click', () => {
    const open = !root.classList.contains('menu-open')
    root.classList.toggle('menu-open', open)
    button.setAttribute('aria-expanded', String(open))
    button.textContent = open ? 'Close' : 'Menu'
  })
  menu.querySelectorAll('a').forEach((link) => link.addEventListener('click', close))
  window.addEventListener('resize', () => {
    if (innerWidth > 800) close()
  })
}

function initTilts(): void {
  if (reduceMotion || !matchMedia('(hover: hover) and (pointer: fine)').matches) return
  document.querySelectorAll<HTMLElement>('[data-tilt]').forEach((card) => {
    card.addEventListener('pointermove', (event) => {
      const bounds = card.getBoundingClientRect()
      const x = (event.clientX - bounds.left) / bounds.width
      const y = (event.clientY - bounds.top) / bounds.height
      card.style.setProperty('--tilt-x', `${(0.5 - y) * 3.5}deg`)
      card.style.setProperty('--tilt-y', `${(x - 0.5) * 4}deg`)
      card.style.setProperty('--glow-x', `${x * 100}%`)
      card.style.setProperty('--glow-y', `${y * 100}%`)
    })
    card.addEventListener('pointerleave', () => {
      card.style.setProperty('--tilt-x', '0deg')
      card.style.setProperty('--tilt-y', '0deg')
    })
  })
}

function initPortraitSystem(): void {
  const portrait = document.querySelector<HTMLElement>('.portrait-card')
  if (!portrait || reduceMotion || matchMedia('(hover: hover) and (pointer: fine)').matches) return

  const observer = new IntersectionObserver(
    (entries) => {
      if (!entries.some((entry) => entry.isIntersecting)) return
      portrait.classList.add('is-scanning')
      window.setTimeout(() => portrait.classList.remove('is-scanning'), 1650)
      observer.disconnect()
    },
    { threshold: 0.55 },
  )

  observer.observe(portrait)
}

function initClock(): void {
  const target = document.querySelector<HTMLElement>('#console-clock')
  if (!target) return
  const formatter = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'America/Sao_Paulo',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  })
  const tick = () => {
    target.textContent = `${formatter.format(new Date())} BRT`
  }
  tick()
  window.setInterval(tick, 1000)
}

initTheme()
initHero()
initLiquid()
initReveals()
initProgress()
initMenu()
initTilts()
initPortraitSystem()
initClock()
