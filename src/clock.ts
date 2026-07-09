/** Live Belo Horizonte clock in the nav and footer. */
export function initClock(): void {
  const targets = [
    document.getElementById('clock'),
    document.getElementById('clock-footer'),
  ].filter((el): el is HTMLElement => el !== null)
  if (targets.length === 0) return

  const fmt = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'America/Sao_Paulo',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })

  const update = () => {
    const now = fmt.format(new Date())
    for (const el of targets) el.textContent = now
  }

  update()
  window.setInterval(update, 1000)
}
