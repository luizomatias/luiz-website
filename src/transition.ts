/** Circular world-wipe: the new state floods the page from a given point,
 *  via the View Transitions API. Falls back to the plain CSS-var fade. */

type DocWithVT = Document & {
  startViewTransition?: (update: () => void) => unknown
}

export function worldWipe(x: number, y: number, apply: () => void): void {
  const doc = document as DocWithVT
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches

  if (reduced || typeof doc.startViewTransition !== 'function') {
    apply()
    return
  }

  const root = document.documentElement
  root.style.setProperty('--vt-x', `${x.toFixed(0)}px`)
  root.style.setProperty('--vt-y', `${y.toFixed(0)}px`)
  doc.startViewTransition(apply)
}
