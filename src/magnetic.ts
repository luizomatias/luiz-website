/** Gentle magnetic pull on [data-magnetic] elements. */
export function initMagnetic(): void {
  if (!matchMedia('(hover: hover) and (pointer: fine)').matches) return
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return

  document.querySelectorAll<HTMLElement>('[data-magnetic]').forEach((el) => {
    el.style.transition = 'transform 0.35s cubic-bezier(0.22, 1, 0.36, 1)'
    el.style.display = el.style.display || 'inline-block'
    el.style.willChange = 'transform'

    el.addEventListener('mousemove', (e) => {
      const r = el.getBoundingClientRect()
      const dx = e.clientX - (r.left + r.width / 2)
      const dy = e.clientY - (r.top + r.height / 2)
      el.style.transform = `translate(${dx * 0.22}px, ${dy * 0.22}px)`
    })

    el.addEventListener('mouseleave', () => {
      el.style.transform = 'translate(0, 0)'
    })
  })
}
