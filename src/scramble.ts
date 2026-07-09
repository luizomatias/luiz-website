/** Katakana decode effect: on hover, text scrambles through kana and
 *  resolves back to the original, left to right. */

const GLYPHS =
  'アイウエオカキクケコサシスセソタチツテトナニヌネノハヒフヘホマミムメモヤユヨラリルレロワヲン'

export function initScramble(): void {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return
  if (!matchMedia('(hover: hover) and (pointer: fine)').matches) return

  document.querySelectorAll<HTMLElement>('[data-scramble]').forEach((el) => {
    const original = el.textContent ?? ''
    if (!original.trim()) return

    // lock width so the wider kana don't shift the layout
    el.style.display = 'inline-block'
    let raf = 0

    const run = () => {
      if (raf) return
      el.style.minWidth = `${el.offsetWidth}px`
      const duration = 480
      const start = performance.now()

      const step = (now: number) => {
        const t = Math.min(1, (now - start) / duration)
        const resolved = Math.floor(t * original.length)
        let out = original.slice(0, resolved)
        for (const ch of original.slice(resolved)) {
          out +=
            ch === ' '
              ? ' '
              : GLYPHS[Math.floor(Math.random() * GLYPHS.length)]
        }
        el.textContent = out
        if (t < 1) {
          raf = requestAnimationFrame(step)
        } else {
          el.textContent = original
          raf = 0
        }
      }
      raf = requestAnimationFrame(step)
    }

    const trigger = el.closest<HTMLElement>('a, button, .job') ?? el
    trigger.addEventListener('mouseenter', run)
  })
}
