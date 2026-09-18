import { appPath } from '../lib/paths'
import logoUrl from '../../logo/logo.svg'

export default function LandingHeader() {
  return <header className="landing-header"><a className="brand" href={appPath()} aria-label="waripon トップページ"><img src={logoUrl} alt="waripon" /></a></header>
}
