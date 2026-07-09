/** Brief intro curtain; skipped on repeat visits within the session. */
export function initPreloader(): void {
  const el = document.querySelector<HTMLElement>('.preloader')
  if (!el) return

  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches
  const seen = sessionStorage.getItem('seen-intro') === '1'
  const delay = reduced || seen ? 0 : 1100

  const finish = () => {
    el.classList.add('is-done')
    document.body.classList.add('is-loaded')
    sessionStorage.setItem('seen-intro', '1')
  }

  if (delay === 0) {
    // let the first paint happen, then reveal immediately
    requestAnimationFrame(() => requestAnimationFrame(finish))
  } else {
    window.setTimeout(finish, delay)
  }
}
