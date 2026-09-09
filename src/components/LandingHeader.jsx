import logoUrl from '../../logo/logo.svg'

export default function LandingHeader() {
  return <header className="landing-header"><a className="brand" href="/" aria-label="waripon トップページ"><img src={logoUrl} alt="waripon" /></a></header>
}
