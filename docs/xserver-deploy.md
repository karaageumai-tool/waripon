# Xserverへの公開

公開URL: https://merylomm.com/waripon/

## GitHubからの自動デプロイ（初回設定）

`main` へのpushで `.github/workflows/deploy-xserver.yml` が実行され、検査・ビルドが成功した場合だけXserverへ転送します。GitHubのActionsから手動実行もできます。VercelへのGit自動デプロイは `vercel.json` で無効にしています。

XserverのサーバーIDは `qon09`、SSHは有効です。接続先は `qon09.xsrv.jp`、ポートは `10022`、配置先は `/home/qon09/merylomm.com/public_html/waripon/` です。

[GitHubのActions Secrets](https://github.com/karaageumai-tool/waripon/settings/secrets/actions) の「New repository secret」で次を登録します。

| Secret名 | 値 |
| --- | --- |
| `XSERVER_HOST` | `qon09.xsrv.jp` |
| `XSERVER_USER` | `qon09` |
| `XSERVER_SSH_KEY` | Xserverに公開鍵を登録した、デプロイ専用のパスフレーズなし秘密鍵の全文 |
| `XSERVER_KNOWN_HOSTS` | 接続先の確認済みSSHホスト鍵（`[qon09.xsrv.jp]:10022` のknown_hosts行） |
| `VITE_SUPABASE_URL` | ローカル `.env` の `NEXT_PUBLIC_SUPABASE_URL` と同じ値 |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | ローカル `.env` の `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` と同じ値。service_roleは使いません |

SSH鍵はXserverサーバーパネルの「SSH設定」で公開鍵を登録します。秘密鍵はGit・チャットへ貼り付けません。ホスト鍵は初回接続時に正しいサーバーであることを確認して保存したknown_hostsの行を使用してください。`ssh-keyscan -p 10022 qon09.xsrv.jp` でも取得できますが、その出力だけで接続先を信用せず、確認済みの指紋と照合してください。

登録後、[Actions](https://github.com/karaageumai-tool/waripon/actions) →「Deploy to Xserver」→「Run workflow」→ `main` を選んで初回実行します。以降は `main` へのpushだけで反映されます。未登録のSecretがある場合は公開前に失敗します。

転送はアプリのフォルダー内に限定し、古いassetsを削除しません。新しいassetsの転送後に `index.html` を置き換えるため、転送中や古いタブからの読み込みも維持します。古いassetsの整理は別途行います。公開後にHTMLがビルド結果と一致するか確認し、不一致ならActionsを失敗にします（自動ロールバックはしません）。戻す場合は変更コミットをrevertしてpushしてください。

Cloudflareの画像APIやSupabaseのSQL変更は、このワークフローの対象外です。

## 手動アップロード

1. `npm run build` を実行します。本番用環境変数は `.env.production`（未定義項目は `.env`）から読み込まれます。
2. XserverのファイルマネージャーまたはFTPで `merylomm.com/public_html/waripon/` を作成します。
3. `dist` **の中身**をそのフォルダーへアップロードします。`index.html`、`assets`、`.htaccess` を含めてください。ソースコードや `.env` はアップロードしません。
4. レシートAPIに新ドメインの許可を反映するため、Cloudflareにログイン済みの環境で `npm run receipts:deploy` を実行します。
5. 公開URLで新規作成・共有URLの再読み込み・FAQ・画像添付を確認します。

`.htaccess` は `/waripon/split/ID` や `/waripon/faq` への直接アクセスをアプリへ渡します。既存サイトの `public_html` 直下のファイルは変更しません。親ディレクトリに独自の転送設定がある場合は、`/waripon/` がその転送対象になっていないか確認してください。

Vercel側（`*.vercel.app`）ではトップページに移転案内と新サイトへのリンクを表示し、新規作成を停止します。この変更はVercelへの再デプロイで反映されます。既存の `/split/ID` は引き続き表示・編集でき、保存期限は変わりません。全URLを新サイトへ転送する設定は不要です。

Supabaseの共有データは同じ接続先を使います。ブラウザー内だけに保存したローカルデータはドメイン間で移動しません。
