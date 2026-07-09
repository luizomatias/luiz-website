/** Split hero lines into individual letters for the staggered rise-in. */
export function initHeroSplit(): void {
  const lines = document.querySelectorAll<HTMLElement>('[data-split]')

  lines.forEach((line, lineIndex) => {
    const text = line.textContent ?? ''
    line.textContent = ''
    line.style.setProperty('--line-i', String(lineIndex))
    line.setAttribute('aria-label', text)

    for (let i = 0; i < text.length; i++) {
      const ch = text[i]
      const span = document.createElement('span')
      span.className = 'char'
      span.textContent = ch === ' ' ? ' ' : ch
      span.style.setProperty('--char-i', String(i))
      span.style.setProperty('--line-i', String(lineIndex))
      span.setAttribute('aria-hidden', 'true')
      line.appendChild(span)
    }
  })

  // letters ripple as the cursor sweeps across them
  if (
    matchMedia('(hover: hover) and (pointer: fine)').matches &&
    !matchMedia('(prefers-reduced-motion: reduce)').matches
  ) {
    document.querySelectorAll<HTMLElement>('.hero-line .char').forEach((char) => {
      char.addEventListener('mouseenter', () => {
        if (!document.body.classList.contains('is-loaded')) return
        char.classList.add('char-wave')
      })
      char.addEventListener('animationend', () => {
        char.classList.remove('char-wave')
      })
    })
  }
}
