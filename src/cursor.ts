/** Custom cursor: instant dot + lagging ring that grows over interactive elements. */
export function initCursor(): void {
  if (!matchMedia('(hover: hover) and (pointer: fine)').matches) return

  const cursor = document.querySelector<HTMLElement>('.cursor')
  const label = document.querySelector<HTMLElement>('.cursor-label')
  if (!cursor || !label) return

  let mx = -100
  let my = -100
  let rx = -100
  let ry = -100
  let visible = false

  document.addEventListener('mousemove', (e) => {
    mx = e.clientX
    my = e.clientY
    if (!visible) {
      visible = true
      rx = mx
      ry = my
      cursor.classList.remove('is-hidden')
    }
  })

  document.addEventListener('mouseleave', () => {
    visible = false
    cursor.classList.add('is-hidden')
  })

  const interactive = 'a, button, [data-cursor], [role="button"]'
  document.addEventListener('mouseover', (e) => {
    const target = (e.target as HTMLElement).closest<HTMLElement>(interactive)
    cursor.classList.toggle('is-active', !!target)
    label.textContent = target?.dataset.cursor ?? ''
  })

  const tick = () => {
    rx += (mx - rx) * 0.16
    ry += (my - ry) * 0.16
    cursor.style.setProperty('--cx', `${mx}px`)
    cursor.style.setProperty('--cy', `${my}px`)
    cursor.style.setProperty('--rx', `${rx.toFixed(1)}px`)
    cursor.style.setProperty('--ry', `${ry.toFixed(1)}px`)
    requestAnimationFrame(tick)
  }
  requestAnimationFrame(tick)
}
