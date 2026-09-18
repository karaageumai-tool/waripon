# Xserverへの公開

公開URL: https://merylomm.com/waripon/

1. `npm run build` を実行します。本番用環境変数は `.env.production`（未定義項目は `.env`）から読み込まれます。
2. XserverのファイルマネージャーまたはFTPで `merylomm.com/public_html/waripon/` を作成します。
3. `dist` **の中身**をそのフォルダーへアップロードします。`index.html`、`assets`、`.htaccess` を含めてください。ソースコードや `.env` はアップロードしません。
4. レシートAPIに新ドメインの許可を反映するため、Cloudflareにログイン済みの環境で `npm run receipts:deploy` を実行します。
5. 公開URLで新規作成・共有URLの再読み込み・FAQ・画像添付を確認します。

`.htaccess` は `/waripon/split/ID` や `/waripon/faq` への直接アクセスをアプリへ渡します。既存サイトの `public_html` 直下のファイルは変更しません。親ディレクトリに独自の転送設定がある場合は、`/waripon/` がその転送対象になっていないか確認してください。

Vercel側（`*.vercel.app`）ではトップページに移転案内と新サイトへのリンクを表示し、新規作成を停止します。この変更はVercelへの再デプロイで反映されます。既存の `/split/ID` は引き続き表示・編集でき、保存期限は変わりません。全URLを新サイトへ転送する設定は不要です。

Supabaseの共有データは同じ接続先を使います。ブラウザー内だけに保存したローカルデータはドメイン間で移動しません。
