# waripon

公開先: https://merylomm.com/waripon/ — [Xserverへの配置手順](docs/xserver-deploy.md)

短い個別URLで割り勘を共有できるReactアプリです。Supabaseを設定すると、複数端末間でデータを同期します。

## セットアップ

```sh
npm install
cp .env.example .env
npm run dev
```

`.env` にSupabaseのProject URLとPublishable keyを設定してください。

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=your-publishable-key
```

Supabase DashboardのSQL Editorで
`supabase/migrations/20260903000000_create_splits.sql` を実行すると、テーブル、アクセス制御、保存・取得関数が作成されます。

接続情報がない場合はlocalStorageへ保存するローカルモードで動作します。

## Vercelへのデプロイ

VercelでGitHubリポジトリ `karaageumai-tool/waripon` をImportし、Production Branchを`main`に設定してください。以後、`main`へのpushごとに本番環境が自動更新されます。

VercelのProject Settings → Environment Variablesで、次の2項目をProduction・Previewへ設定します。

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=your-publishable-key
```

`vercel.json`のrewrite設定により、`/split/...`を直接開いた場合もReactアプリが表示されます。

## 保存期限（6か月）

既存環境では `supabase/migrations/20260909000000_expire_splits.sql` をSupabaseのSQL Editorで実行してから、アプリをデプロイしてください。新規環境ではmigrations内のSQLをファイル名順に実行します。DBへの管理接続が必要です。

- 発行から暦上の6か月（UTC基準、月末は末日に丸める）で取得・更新できなくなり、毎分のCronで期限切れ行を削除します。更新しても期限は延長されません。
- 既存データには発行日時がないため、最終更新日時から6か月を期限とします。
- 新規発行はサーバーがIDを生成する `create_split` のみで行い、`save_split` は更新専用です。削除済みURLからデータを再作成できません。
- 共有モードではlocalStorageに保存しません。過去のブラウザ保存データは次回アクセス時に削除します。ローカルモードは期限付き保存で、アプリ起動中または次回アクセス時に削除します。期限情報のない旧ローカルデータも削除対象です。
- Cronの実行成功はSupabase DashboardのIntegrations → Cronで確認してください。停止・障害時は物理削除が遅れますが、期限切れデータの取得・更新は拒否されます。
- この削除は稼働DBの行を対象とします。Supabaseのバックアップや利用者が保存したコピーまで同時に消去するものではありません。

Cronの設定仕様: https://supabase.com/docs/guides/cron

期限計算のテスト: `node --test src/lib/expiration.test.js`

## レシート画像（R2）

画像はCloudflare R2の非公開バケットに保存します。支払い1件につき3枚、1枚300KBまでで、
割り勘ページと同じ期限に削除します。全体の保存上限は8GBです。
設定方法は [レシート画像の設定](docs/receipts-setup.md) を参照してください。

## コマンド

```sh
npm run dev
npm run lint
npm run build
```

## セキュリティ

`splits` テーブルはanon/authenticatedロールから直接アクセスできません。URLに含まれる推測困難な英数字IDを専用関数へ渡した場合だけ、該当データを取得・更新できます。URLを知っている人は編集できるため、共有範囲には注意してください。

<!--

This template provides a minimal setup to get React working in Vite with HMR and some Oxlint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the Oxlint configuration

If you are developing a production application, we recommend using TypeScript with type-aware lint rules enabled. Check out the [TS template](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts) for information on how to integrate TypeScript and Oxlint's TypeScript related rules in your project.
-->
