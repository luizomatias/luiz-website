/** Experience rail: an accent line draws itself down the job list as the
 *  section scrolls through the viewport. */
export function initTimeline(): void {
  const jobs = document.querySelector<HTMLElement>('.jobs')
  if (!jobs) return

  if (matchMedia('(prefers-reduced-motion: reduce)').matches) {
    jobs.style.setProperty('--jobs-progress', '1')
    return
  }

  let ticking = false

  const update = () => {
    ticking = false
    const rect = jobs.getBoundingClientRect()
    // the line tip tracks a point ~75% down the viewport
    const p = (window.innerHeight * 0.75 - rect.top) / rect.height
    jobs.style.setProperty('--jobs-progress', Math.min(1, Math.max(0, p)).toFixed(4))
  }

  document.addEventListener(
    'scroll',
    () => {
      if (!ticking) {
        ticking = true
        requestAnimationFrame(update)
      }
    },
    { passive: true },
  )
  update()
}
