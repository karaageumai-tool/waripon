const SiteFooter = ({ className = '' }) => (
  <footer className={`site-footer ${className}`}>
    <div className="footer-brand">waripon <span>ワリポン</span></div>
    <div className="footer-meta"><span>©2026 ise</span><a href="/faq">よくある質問</a><a href="https://forms.gle/eizDPPzmAqK2HmNx7" target="_blank" rel="noreferrer">お問い合わせ</a></div>
  </footer>
)

export default SiteFooter
