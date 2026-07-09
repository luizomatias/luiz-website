import { worldWipe } from './transition'

/**
 * The centrepiece: a lens follows the cursor over the portrait revealing the
 * anime version underneath; activating it flips the whole site between the
 * IRL and ANIME worlds (theme, texture, marquee speed).
 */
export function initPortrait(): void {
  const portrait = document.getElementById('portrait')
  if (!portrait) return

  const frame = portrait.querySelector<HTMLElement>('.portrait-frame')
  const modeNote = document.getElementById('mode-note')
  const root = document.documentElement
  const fine = matchMedia('(hover: hover) and (pointer: fine)').matches
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches

  // --- lens follows the pointer (desktop only) ---
  if (fine && frame) {
    portrait.addEventListener('mousemove', (e) => {
      const r = frame.getBoundingClientRect()
      const x = ((e.clientX - r.left) / r.width) * 100
      const y = ((e.clientY - r.top) / r.height) * 100
      portrait.classList.add('is-lensing')
      frame.style.setProperty('--lens-x', `${x.toFixed(2)}%`)
      frame.style.setProperty('--lens-y', `${y.toFixed(2)}%`)
      frame.style.setProperty('--lens-r', '19%')

      // subtle tilt toward the cursor
      const tx = ((e.clientX - r.left) / r.width - 0.5) * 6
      const ty = ((e.clientY - r.top) / r.height - 0.5) * 6
      frame.style.setProperty('--tilt-r', `${(tx * 0.25).toFixed(2)}deg`)
      frame.style.setProperty('--tilt-x', `${tx.toFixed(1)}px`)
      frame.style.setProperty('--tilt-y', `${ty.toFixed(1)}px`)
    })

    portrait.addEventListener('mouseleave', () => {
      portrait.classList.remove('is-lensing')
      frame.style.setProperty('--lens-r', '0%')
      frame.style.setProperty('--tilt-r', '0deg')
      frame.style.setProperty('--tilt-x', '0px')
      frame.style.setProperty('--tilt-y', '0px')
    })
  }

  // --- world switch ---
  const pow = portrait.querySelector<HTMLElement>('.portrait-pow')

  const toggle = (x: number, y: number) => {
    const next = root.dataset.mode === 'irl' ? 'anime' : 'irl'

    if (!reduced) {
      portrait.classList.remove('is-bursting')
      // restart the burst + onomatopoeia animation
      void portrait.offsetWidth
      if (pow) pow.textContent = next === 'anime' ? 'ドンッ!!' : 'スッ…'
      portrait.classList.add('is-bursting')
    }

    worldWipe(x, y, () => {
      root.dataset.mode = next
      if (modeNote) modeNote.textContent = next === 'anime' ? 'アニメ' : 'IRL'
    })

    // let the lens rest so the full reveal reads from its last position
    frame?.style.setProperty('--lens-r', '0%')
  }

  portrait.addEventListener('click', (e) => toggle(e.clientX, e.clientY))
  portrait.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      const r = portrait.getBoundingClientRect()
      toggle(r.left + r.width / 2, r.top + r.height / 2)
    }
  })
}
