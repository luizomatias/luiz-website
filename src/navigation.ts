export function initNavigation(): void {
  const nav = document.querySelector<HTMLElement>('.nav')
  const toggle = document.getElementById('nav-menu-toggle')
  const links = document.querySelectorAll<HTMLAnchorElement>('.nav-links a')
  if (!nav || !toggle) return

  const setOpen = (open: boolean) => {
    nav.classList.toggle('is-menu-open', open)
    document.body.classList.toggle('is-menu-open', open)
    toggle.setAttribute('aria-expanded', String(open))
    toggle.setAttribute('aria-label', open ? 'Close site index' : 'Open site index')
    toggle.textContent = open ? 'CLOSE' : 'INDEX'
  }

  toggle.addEventListener('click', () => {
    setOpen(!nav.classList.contains('is-menu-open'))
  })

  links.forEach((link) => link.addEventListener('click', () => setOpen(false)))
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') setOpen(false)
  })

  // ---- scroll-spy: mark the section currently in view ----------------------
  // a narrow band around the upper-middle of the viewport decides the winner,
  // so exactly one section is "current" at a time (none while in the hero)
  const byTarget = new Map<Element, HTMLAnchorElement>()
  links.forEach((link) => {
    const target = document.querySelector(link.hash)
    if (target) byTarget.set(target, link)
  })

  const setCurrent = (section: Element | null) => {
    byTarget.forEach((link, el) => {
      const on = el === section
      link.classList.toggle('is-current', on)
      if (on) link.setAttribute('aria-current', 'true')
      else link.removeAttribute('aria-current')
    })
  }

  const spy = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) setCurrent(entry.target)
        else if (byTarget.get(entry.target)?.classList.contains('is-current')) setCurrent(null)
      }
    },
    { rootMargin: '-35% 0px -60% 0px' }
  )
  byTarget.forEach((_link, el) => spy.observe(el))
}
