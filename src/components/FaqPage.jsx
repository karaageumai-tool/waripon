import { useEffect } from 'react'
import LandingHeader from './LandingHeader'
import SiteFooter from './SiteFooter'

const sections = [
  {
    title: '使い方・精算',
    items: [
      ['割り勘はどうやって始めますか？', 'トップページで「新しい割り勘を作成」を押し、メンバーを追加してください。「支払いを記録」で内容・支払った人・金額を入力し、「誰のぶん？」で負担するメンバーを選んで追加します。'],
      ['一部のメンバーだけの支払いも記録できますか？', 'できます。「誰のぶん？」で、その支払いを負担するメンバーだけを選んでください。入力した金額を、選んだメンバーで均等に分けて計算します。'],
      ['「精算する」に表示されたら、送金も完了しますか？', 'wariponは、誰から誰へいくら支払うかを計算するアプリです。実際の送金は行いません。表示された金額を確認し、現金やお使いの送金サービスなどで精算してください。'],
      ['支払いを間違えて登録した場合はどうすればよいですか？', '支払い一覧の「×」で該当する支払いを削除し、正しい内容で追加し直してください。その支払いに添付した画像も削除対象になるため、必要な画像は改めて添付してください。'],
    ],
  },
  {
    title: '共有・保存期限',
    items: [
      ['メンバーにはどうやって共有しますか？', 'ページ右上の「共有する」からURLをコピーして送るか、LINE・Xの共有ボタンを使ってください。同じURLを開くと、メンバー間で割り勘の内容を共有できます。'],
      ['共有したページは誰でも編集できますか？', 'その割り勘のURLを知っている人は、内容の閲覧・追加・削除ができます。閲覧専用の権限はありません。URLは一緒に精算するメンバーに共有してください。'],
      ['ページやレシート画像はいつまで保存されますか？', '割り勘ページの発行から6か月です。有効期限はページ下部に表示されます。途中で支払いや画像を追加しても期限は延長されません。期限を過ぎると利用できなくなり、保存データと画像は順次自動削除されます。'],
      ['ページを手動で削除したい', 'ページ全体を手動で削除する機能はありません。ページは発行から6か月で利用できなくなり、保存データと画像は順次自動削除されます。期限前に内容を消したい場合は、メンバー・支払い・添付画像をそれぞれ「×」から削除してください。内容をすべて削除しても、ページのURLは有効期限まで残ります。'],
      ['有効期限を延長したり、削除されたページを復元したりできますか？', '有効期限の延長や、削除済みページの復元はできません。必要な精算内容や画像は、有効期限までにお手元に控えてください。'],
    ],
  },
  {
    title: 'レシート画像・困ったとき',
    items: [
      ['レシート画像はどこから添付できますか？', '「支払いを記録」ブロックの「レシートを添付」から画像を選び、「支払いを追加」を押してください。保存した画像は支払い一覧の「画像を開く」ボタンから確認できます。'],
      ['添付できる画像の種類・サイズ・枚数を教えてください。', 'JPEG・PNG・WebPに対応しています。元画像は1枚20MBまで選択でき、保存前にJPEG形式・1枚300KB以下へ自動圧縮します。支払い1件につき最大3枚です。HEICやPDFは対応していないため、JPEGなどに変換してから添付してください。'],
      ['画像を添付できない場合はどうすればよいですか？', '画像の形式・枚数と通信状況を確認してください。圧縮できない場合は、レシート部分を切り抜いて再度お試しください。画像だけ保存に失敗した場合は、画面の案内に従って「画像の保存を再試行」を押してください。保存容量の上限に達した場合は、新しい画像を保存できません。'],
      ['変更が反映されない、ページが開かない場合は？', '通信状況とページ上部の保存状態を確認してください。共有内容の反映には数秒かかることがあります。ページを開けない場合は、URLが正しいか、有効期限を過ぎていないかをご確認ください。'],
    ],
  },
]

export default function FaqPage() {
  const goBack = (event) => {
    if (window.history.length > 1) {
      event.preventDefault()
      window.history.back()
    }
  }

  useEffect(() => {
    const previous = document.title
    document.title = 'よくある質問 | waripon'
    return () => { document.title = previous }
  }, [])

  return <div className="app-shell faq-shell">
    <LandingHeader />
    <main className="faq-main">
      <a className="faq-back" href="/" onClick={goBack}>← 前のページに戻る</a>
      <div className="faq-intro"><p className="eyebrow">FAQ</p><h1>よくある質問</h1><p className="lead">使い方や共有、レシートの保存について。</p></div>
      {sections.map((section, sectionIndex) => <section className="faq-section" key={section.title} aria-labelledby={`faq-section-${sectionIndex}`}>
        <h2 id={`faq-section-${sectionIndex}`}>{section.title}</h2>
        <div className="panel faq-list">{section.items.map(([question, answer]) => <details className="faq-item" key={question}>
          <summary>{question}</summary><p>{answer.replace(/。/g, '。\n').trimEnd()}</p>
        </details>)}</div>
      </section>)}
      <nav className="faq-bottom-links" aria-label="FAQページ下部のナビゲーション">
        <a className="faq-back" href="/" onClick={goBack}>← 前のページに戻る</a>
        <a className="faq-back" href="/">トップページへ</a>
      </nav>
    </main>
    <SiteFooter className="landing-footer" />
  </div>
}
