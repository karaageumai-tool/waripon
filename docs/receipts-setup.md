# レシート画像の設定

画面はVercel、割り勘と画像管理情報はSupabase、画像本体は非公開のR2に保存します。
Cloudflare Workersが画像のアップロード・取得・削除を担当します。

## 1. R2を有効にする

Cloudflare Dashboardで使用するアカウントを選び、R2 Object Storageを開きます。
初回はR2の利用開始手続きが必要です。画面で料金・支払い情報を確認してください。
Standardの無料枠は月10 GB-month、Class A操作100万回、Class B操作1,000万回です。
無料枠を超えると課金される従量制です。Infrequent Accessは使用しません。

プロジェクトのターミナルでログインし、バケットを作成します。

```sh
npx wrangler login
npx wrangler whoami
npx wrangler r2 bucket create waripon-receipts
```

すでに同名のバケットをDashboardで作った場合、createは不要です。
バケットのPublic Development URL（r2.dev）や公開用Custom Domainは有効にしません。
ブラウザはWorkersと通信するため、R2バケット自体のCORS設定は不要です。

補助の自動削除も登録します。通常の削除はページの期限に基づくWorkersのCronが行います。
このルールはCronの長期停止やアップロード途中の障害で残った画像用です。
184日は暦上の6か月の最大日数に合わせた余裕で、ページの期限を延長するものではありません。

```sh
npx wrangler r2 bucket lifecycle add waripon-receipts cleanup-backstop receipts/ --expire-days 184
```

## 2. Supabaseで画像用SQLを実行

SQL Editorで `supabase/migrations/20260910000000_receipts.sql` の全文を一度実行します。
以前の2つのSQLは適用済みであることが前提です。再実行は不要です。
続けて `supabase/migrations/20260911000000_receipts_300kb.sql` を実行し、新規画像の上限を300KBに変更します。以前の画像用SQLを適用済みの場合は、この300KB用SQLだけ実行してください。
既存の割り勘の内容や有効期限は変更しません。

## 3. Workersの秘密情報を設定

SupabaseのProject URLと、Project SettingsのAPI Keysにある **Legacy API Keys → service_role** を使用します。
公開用のanon／publishable keyでは画像の管理用関数を呼び出せません。
service_roleはブラウザ用`.env`・Vercelの`VITE_`変数・Gitには入れず、チャットにも貼り付けません。

次のコマンドを1つずつ実行し、入力欄に対応する値を貼り付けます。

```sh
npx wrangler secret put SUPABASE_URL --config workers/receipts/wrangler.jsonc
npx wrangler secret put SUPABASE_SERVICE_ROLE_KEY --config workers/receipts/wrangler.jsonc
```

Workerがまだ存在しない場合、作成する旨の案内に従います。
`workers/receipts/wrangler.jsonc` の `ALLOWED_ORIGINS` には本番URLと開発URLを設定済みです。
独自ドメインを使う場合は、末尾スラッシュなしで追加します。

## 4. Workersを公開

```sh
npm run receipts:check
npm run receipts:deploy
```

表示された `https://waripon-receipts.自分のサブドメイン.workers.dev` を控えます。
`/health` にアクセスして `{"ok":true}` が返ることを確認します。
これはWorkerの起動確認です。Supabase・R2の接続確認には実際の画像添付が必要です。
Cron Trigger `*/5 * * * *` が登録されます。設定の反映には時間がかかる場合があります。

## 5. アプリに接続先を設定

ローカルの`.env`に以下を追加し、`npm run dev` を再起動します。

```env
VITE_RECEIPTS_API_URL=https://waripon-receipts.自分のサブドメイン.workers.dev
```

新しい割り勘を作成して「支払いを記録」で内容・金額を入力し、「レシートを添付」で画像を選択してから「支払いを追加」を押してください。画像は支払い一覧から開けます。圧縮後の画像を開いて文字の読めることも確認します。
本番用の公開API URLは `.env.production` に設定済みです。画像の表示・削除を確認してからアプリをデプロイします。
別のWorkerへ変更する場合は、同ファイルまたはVercelの `VITE_RECEIPTS_API_URL` を更新してください。秘密キーはこのファイルに記載しません。
接続先が未設定の環境では添付ボタンは表示されません。

## 保管・削除の仕様

- 支払い1件につき最大3枚。ブラウザでJPEGに再変換してEXIFを除去し、1枚300,000バイト以下にします。
- 入力はJPEG・PNG・WebP（元画像20MBまで）。HEIC／PDFは未対応です。
- 圧縮後のJPEGのみを保存し、元画像や別のサムネイルは保存しません。
- 現在のページ共有と同様、割り勘URLを知っている人が画像の表示・追加・削除をできます。
- APIは各操作で有効な割り勘と支払いの存在を確認します。画像IDだけでは取得できません。
- 画像は`expires_at`を割り勘から引き継ぎ、途中で追加しても期限を延長しません。
- 期限後は画像を取得できません。5分ごとのCronで最大100件ずつ削除します。
- 支払いを削除した場合も画像は取得できなくなり、Cronで削除します。画像単体の削除はその場でR2削除を試みます。
- 途中で失敗したアップロードは最大1時間の猶予後にCronで削除します。使用容量は削除成功まで予約したままです。
- R2削除成功後に管理情報と容量予約を削除します。DBの割り勘行が先に削除されても管理情報は残り、失敗時は次回Cronで再試行します。
- キャッシュは`no-store`です。すでにダウンロードされた利用者のコピーまで消去することはできません。

## 無料枠の運用

このアプリ専用のバケットを使用してください。アプリ側で未完了分を含む8GBの上限を
DBのロックで管理し、超過するアップロードを拒否します。並行アップロードでも予約分を加算します。
別バケットの利用分やAPI操作回数、Workers・Supabaseの利用枠まではこの制限で止められないため、
無料を保証するものではありません。Cloudflare側でも利用状況と通知を確認してください。

SQL Editorで使用容量を確認できます（画像一覧を公開するAPIはありません）。

```sql
select used_bytes, limit_bytes from public.receipt_quota;
select state, count(*) from public.receipts group by state;
```

`deleting`が長く残る場合はWorkersのCron実行状況・秘密情報・R2バインディングを確認します。
R2の削除前に管理行だけを削除したり、`used_bytes`だけを減らしたりしないでください。

## 開発時の検証

```sh
npm test
npm run test:browser
npm run lint
npm run build
npm run receipts:check
```

DBテストはPGliteでSQLを実行します。ブラウザテストはAPIを模擬し、実データを書き込みません。
ブラウザテストの初回は `npx playwright install chromium` を実行してください。

公式資料:
- https://developers.cloudflare.com/r2/pricing/
- https://developers.cloudflare.com/r2/api/workers/workers-api-reference/
- https://developers.cloudflare.com/r2/buckets/object-lifecycles/
- https://developers.cloudflare.com/workers/configuration/cron-triggers/
- https://developers.cloudflare.com/workers/configuration/secrets/
