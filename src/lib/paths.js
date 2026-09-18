export const appPath = (path = '') => `${import.meta.env.BASE_URL}${path.replace(/^\/+/, '')}`

export const currentAppPath = () => {
  const base = import.meta.env.BASE_URL.replace(/\/$/, '')
  const pathname = window.location.pathname
  return pathname === base ? '/' : pathname.startsWith(`${base}/`) ? pathname.slice(base.length) : pathname
}
