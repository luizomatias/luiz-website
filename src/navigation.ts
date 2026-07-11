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
}
