import { worldWipe } from './transition'

/** Light/dark toggle — layered on top of the IRL/anime world switch.
 *  Initial theme is applied pre-paint by an inline script in index.html. */
export function initTheme(): void {
  const root = document.documentElement
  const btn = document.getElementById('theme-toggle')
  const icon = btn?.querySelector<HTMLElement>('.theme-toggle-icon')
  if (!btn || !icon) return

  let spin = 0

  const apply = (theme: 'light' | 'dark') => {
    root.dataset.theme = theme
    icon.textContent = theme === 'dark' ? '☀' : '☾'
    btn.setAttribute(
      'aria-label',
      theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode',
    )
  }

  apply(root.dataset.theme === 'dark' ? 'dark' : 'light')

  btn.addEventListener('click', () => {
    const next = root.dataset.theme === 'dark' ? 'light' : 'dark'
    try {
      localStorage.setItem('theme', next)
    } catch {
      /* private browsing */
    }
    spin += 180
    icon.style.setProperty('--theme-spin', `${spin}deg`)
    const r = btn.getBoundingClientRect()
    worldWipe(r.left + r.width / 2, r.top + r.height / 2, () => apply(next))
  })
}
