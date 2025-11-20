# 🚀 Hono + Bun Monorepo テンプレート

Cloudflare エコシステム（Workers / Pages / D1 / Turnstile / R2 など）を前提にした、Bun ベースのモノレポ開発環境です。
高速性とセキュリティを両立させつつ、API・管理画面・外部サイト連携を一括で管理できるよう務めています。

> 👣 **初めてのセットアップや Cloudflare 設定は** `Readme-beginners.md` を参照してください。
> 外部プロジェクトから API を利用する場合は `Readme-external.md` を確認します。

## 目次

- [ドキュメントの読み方](#ドキュメントの読み方)
- [リポジトリ構成と役割](#リポジトリ構成と役割)
- [ディレクトリ構成サマリー](#ディレクトリ構成サマリー)
- [運用ポリシー（2025-10-29 時点）](#運用ポリシー2025-10-29-時点)
- [セキュリティ / 品質レイヤー](#セキュリティ--品質レイヤー)
- [代表的な API エンドポイント](#代表的な-api-エンドポイント)
- [CI / デプロイ ハイレベルフロー](#ci--デプロイ-ハイレベルフロー)
- [運用でよく使うコマンド](#運用でよく使うコマンド)
- [データベース / シード](#データベース--シード)
- [お問い合わせフォーム定義の管理](#お問い合わせフォーム定義の管理)
- [観測とドキュメント](#観測とドキュメント)
- [参考リンク](#参考リンク)

## ドキュメントの読み方

- `Readme-beginners.md`: Cloudflare 事前準備、ローカル環境構築、デプロイ手順、CI 例など「実作業マニュアル」。
- `Readme-external.md`: 外部 Astro 等から API を安全に呼び出すための統合ガイド。

## リポジトリ構成と役割

- `apps/api`: Hono + Prisma による API（Cloudflare Workers / D1）。`prisma/seed.ts` で初期データ投入を管理します。
- `apps/admin`: SvelteKit 製の管理画面（Cloudflare Pages 向け）。Turnstile によるログイン保護を前提とします。
- `apps/web`: Astro 製フロントサイト。現在はテスト/検証用途のローカル専用で、本番公開は想定していません。
- `packages/*`: Storybook 対応 UI、共通設定、型定義など。Turborepo により横断ビルド・キャッシュ最適化を行います。

> D1 データベース名は `hono-db` に限られません。`apps/api/wrangler.toml` と CI 設定で一貫していれば任意名で運用可能です。

## ディレクトリ構成サマリー

```bash
.
├── apps/
│   ├── api/
│   │   ├── src/
│   │   │   ├── middleware/    # 認証・レート制限などの共通ミドルウェア
│   │   │   ├── routes/        # OpenAPI 定義済みのエンドポイント群
│   │   │   ├── schemas/       # Zod スキーマとバリデーション
│   │   │   ├── services/      # ビジネスロジック
│   │   │   ├── repositories/  # D1/Prisma アクセス
│   │   │   ├── utils/         # env 検証・Turnstile 連携など
│   │   │   └── tests/         # Vitest
│   │   ├── prisma/            # schema.prisma / migrations / seed
│   │   └── wrangler.toml      # Cloudflare Workers 設定
│   ├── admin/                 # SvelteKit 管理画面（Pages デプロイ）
│   └── web/                   # Astro サイト（検証用）
├── packages/
│   ├── ui/                    # 共通 UI コンポーネント（Storybook 対応）
│   ├── components/            # フレームワーク横断コンポーネント
│   ├── types/                 # 共有型定義
│   ├── utils/                 # 汎用ユーティリティ
│   └── *config                # Playwright / Vitest / Tailwind / TypeScript 設定群
├── docker-compose.yml         # 開発用コンテナ定義
├── turbo.json                 # Turborepo タスク設定
└── Readme-beginners.md        # セットアップ詳細ガイド
```

## 運用ポリシー（2025-10-29 時点）

- **API (`apps/api`)**: Cloudflare Workers への手動デプロイ。D1 マイグレーションを確実に適用してから `bunx wrangler deploy` を実行します。すべての Wrangler コマンドはホスト OS の `apps/api` ディレクトリで実行してください（Docker 内では認証が通りません）。
- **Admin (`apps/admin`)**: Cloudflare Pages と GitHub 連携で自動デプロイ。環境変数は Pages 側に登録し、`PUBLIC_API_BASE_URL`・`PUBLIC_ASSET_BASE_URL` を忘れずにセットします。
- **Web (`apps/web`)**: 現在は E2E テストとローカル検証、外部webアプリのサンプルとして利用。必要になった際にのみ Pages へ接続します。
- **Prisma CLI**: `docker compose exec hono_api ...` のみが D1 アダプターを正しく読み込みます。`hono_dev` コンテナから `bunx prisma` を実行しないでください。

## セキュリティ / 品質レイヤー

- JWT 認証 + 5 回失敗で自動ロックアウト。
- `@hono/csrf` による CSRF 検証と Turnstile（ログイン・問い合わせ双方）でのボット対策。
- Zod + サニタイズユーティリティでリクエスト本文を検証し、XSS や不正入力を遮断。
- `rateLimit` ミドルウェアでグローバルなリクエスト制限を実施。
- 監査ログ・エラーログの暗号化保存 (`AUDIT_LOG_ENCRYPTION_KEY`) と `bunx wrangler tail` による運用監視を推奨。
- hono/cors のデフォルト挙動より細かく制御するために、CORSは独自ミドルウェアを噛ませている(1) Cloudflare Workers で Origin を厳密にホワイトリスト管理したい、(2) 未許可オリジンをレスポンスではなくリクエスト段階でブロックしてログ出力したい、(3) Access-Control-Allow-Credentials を常時 true にしつつ * にはしないなど
- Cloudflare R2 を使ってファイルを受け付ける場合は、アップロード直後に必ずマルウェアスキャンを挟む（Cloudflare の有料プランで WAF/Zero Trustで対応、もしくは VirusTotal 等の外部スキャンサービス）。スキャン未完了のファイルは公開 URL へ割り当てない。

詳細な設定値や解除手順は `Readme-beginners.md`を参照してください。

## 代表的な API エンドポイント

| メソッド | パス | 概要 | 認証 |
| --- | --- | --- | --- |
| `POST` | `/app/api/auth/register` | ユーザー登録。パスワード強度チェックあり。 | 不要 |
| `POST` | `/app/api/auth/login` | ログイン。失敗 5 回でアカウントロック。 | 不要 |
| `GET` | `/app/api/protected` | JWT 検証サンプル。 | 必須 |
| `POST` | `/app/api/contact` | お問い合わせ送信（Turnstile + Resend 連携）。 | 不要 |
| `GET` | `/app/api/contact` | お問い合わせ一覧（ページング対応）。 | 必須 |
| `GET` | `/app/api/contact/forms/public/{slug}` | 公開フォーム定義の取得。 | 不要 |
| `GET` | `/app/api/posts/public` | 公開投稿一覧。カテゴリ／キーワードで絞り込み可。 | 不要 |
| `POST` | `/app/api/posts` | 投稿作成。カスタムフィールドを含む。 | 必須 |
| `GET` | `/doc` | OpenAPI JSON。 | 不要 |
| `GET` | `/swagger` | Swagger UI。 | 不要 |

そのほかのエンドポイントは Swagger UI で確認し、必要に応じて `/doc` の OpenAPI JSON をクライアント生成に利用してください。

## CI / デプロイ ハイレベルフロー

推奨パイプライン（例: GitHub Actions）

1. `bun install`
2. `bun run lint` → `bun test`
3. `bun run db:migrate:remote`（=`bunx wrangler d1 migrations apply <DB_NAME> --remote`）
4. 確認クエリ：`bunx wrangler d1 execute <DB_NAME> --remote --command "SELECT name FROM sqlite_master WHERE type='table';"`
   - 必要なテーブル（例: `Post`, `Category`, `PostSetting` など）が欠損していないかログを確認します。欠損時はジョブを失敗させてコードをデプロイしません。
5. `bunx wrangler deploy`
6. 運用チェック：`bunx wrangler tail --format pretty --sampling-rate 0.1`（環境ごとに絞りたい場合は `--env <name>` を追加し、`wrangler.toml` に対応する `[env.<name>]` を定義する）

Pages プロジェクト（Admin/Web）は GitHub 連携に任せて構いません。API だけはマイグレーション適用が確認できるまで手動で実行します。

## 運用でよく使うコマンド

| シナリオ | コマンド | 備考 |
| --- | --- | --- |
| 依存更新 | `bun install` | ルートで実行。Docker 内からでも可。 |
| ローカル開発起動 | `docker compose up -d` | すべてのアプリがウォッチモードで起動。 |
| Storybook | `docker compose exec hono_dev bun storybook` | [http://localhost:6006](http://localhost:6006) |
| Prisma ステータス | `docker compose exec hono_api bunx prisma migrate status` | スキーマ差分の確認。 |
| Prisma Client 再生成 | `docker compose exec hono_api bunx prisma generate` | `schema.prisma` 変更時に必須。 |
| D1 マイグレーション（リモート） | `bunx wrangler d1 migrations apply <DB_NAME> --remote` | ホスト `apps/api` から実行。 |
| D1 テーブル確認 | `bunx wrangler d1 execute <DB_NAME> --remote --command "SELECT name FROM sqlite_master WHERE type='table';"` | 常に対話無しで実行可能。 |
| Workers デプロイ | `bunx wrangler deploy` | `apps/api` で実行。 |
| リアルタイムログ | `bunx wrangler tail --format pretty --sampling-rate 0.1` | 障害調査時はまず tail。必要に応じて `--env <name>` を追加。 |

## データベース / シード

- Prisma スキーマ: `apps/api/prisma/schema.prisma`
- マイグレーション: `apps/api/prisma/migrations/*`
- 初期データ: `apps/api/prisma/seed.ts`（`docker compose exec hono_api bunx prisma db seed`）
- D1 をリセットする場合は `Readme-beginners.md` の「マイグレーション失敗時の対処」を参照してください。

## お問い合わせフォーム定義の管理

- 定義ファイルは `apps/api/src/config/contactFormDefinitions.ts` に集約されています。`slug` は API と外部フォームの双方で識別子として利用されるため、一意で変更頻度の低い文字列を設定してください。
- `fields` 配列の `order` は表示順に直結します。追加・削除時は連番を維持し、未使用の値が残らないようにします。
- 選択肢を持つフィールドでは `{ value, label }` のペアを追加します。既存 `value` の変更は過去データの参照に影響するため、新しい選択肢を追加した上で不要な値を段階的に整理してください。
- フォームを更新したら `bun run lint` と `bun run test` を実行し、`GET /app/api/contact/forms/public/:slug` が期待通りのレスポンスを返すか確認します。
- 外部 Astro などのクライアントから利用する場合は、`Readme-external.md` のガイドに従ってフォーム定義を API から取得し、ローカルで重複定義を持たない構成を維持してください。
- リッチテキストフィールドの `toolbarPreset` では以下を選択できます。
  - `basic`: 太字 / 斜体 / 下線 / リンク / 文字色
  - `standard`: Basic に加えて箇条書き / 番号付きリスト / 見出し (H2/H3)
  - `full`: Standard に加えて引用 / コードブロック / 罫線 / 改行

## 観測とドキュメント

- Swagger UI: `http://localhost:8787/swagger`
- OpenAPI JSON: `http://localhost:8787/doc`
- Storybook（UI コンポーネントカタログ）: `docker compose exec hono_dev bun storybook`を実行し、ブラウザで `http://localhost:6006` を開いてください。

- Playwright / Vitest: `bun test` / `bun test:admin` / `bun test:e2e`

## 参考リンク

- [Cloudflare Workers](https://developers.cloudflare.com/workers/)
- [Cloudflare Pages](https://developers.cloudflare.com/pages/)
- [Cloudflare D1](https://developers.cloudflare.com/d1/)
- [Cloudflare Turnstile](https://developers.cloudflare.com/turnstile/)
- [Prisma on Cloudflare Workers](https://www.prisma.io/docs/orm/prisma-client/deployment/platform-guides/deploy-to-cloudflare-workers)
- [SvelteKit ドキュメント](https://kit.svelte.dev/docs)
- [Astro ドキュメント](https://docs.astro.build/)
- [Turborepo ドキュメント](https://turbo.build/repo/docs)
- 外部連携の詳細は `Readme-external.md` を参照

開発・運用時は常に `bun run lint` とテストを通し、D1 との整合を確認してからデプロイしてください。
