# waripon

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
