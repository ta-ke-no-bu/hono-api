# 👣 Hono + Bun Monorepo スタートガイド (初めての方向け)

このドキュメントでは、リポジトリのクローンからローカル動作確認、Cloudflare へのデプロイまでを順番に解説します。既に運用中で概要だけ確認したい場合は `Readme.md` を参照してください。外部サービスと連携する際は `Readme-external.md` も合わせてご確認ください。

## 目次

- [1. 事前準備](#1-事前準備)
  - [1.1 必須ツール・アカウント](#11-必須ツールアカウント)
  - [1.2 Cloudflare 設定チェックリスト](#12-cloudflare-設定チェックリスト)
  - [1.3 コマンド実行場所のルール](#13-コマンド実行場所のルール)
  - [1.4 Resend ドメイン設定](#14-resend-ドメイン設定)
- [2. セットアップ手順](#2-セットアップ手順)
- [3. 日常開発でよく行う操作](#3-日常開発でよく行う操作)
- [4. デプロイ手順](#4-デプロイ手順)
- [5. トラブルシューティング](#5-トラブルシューティング)

---

## 1. 事前準備

### 1.1 必須ツール・アカウント

| 項目 | 内容 |
| --- | --- |
| Cloudflare アカウント | Workers / Pages / D1 / R2 / Turnstile が利用できるプランを用意します |
| D1 データベース | 任意の名称（例: `team-api-db`）で作成し `database_id` を控えます |
| Turnstile | 管理画面ログイン用と問い合わせフォーム用にウィジェットを作成し、サイトキーとシークレットを控えます |
| Resend | アカウントを作成し API キーを取得。独自ドメインを利用する場合は TXT / DKIM / MX を設定します |
| R2 (任意) | ファイルアップロードを行う場合はバケットとアクセスキーを準備します |
| Docker / Docker Compose | ローカル開発で使用します |
| Bun 1.2.13 | ルートで `bun` コマンドを実行できるようインストールします |
| Wrangler CLI | ホスト側で `bunx wrangler login` を行うための Cloudflare CLI |

### 1.2 Cloudflare 設定チェックリスト

1. **Workers / Pages プロジェクトの作成**
   - Cloudflare ダッシュボード → Workers & Pages → Create application（新しいUIなら「Hello World を開始する」）
   - apps/api/.envに必要なものを取得していく。現段階ならALLOWED_ORIGINSのurlとか
   - API は Worker として作成し、リポジトリの `apps/api/wrangler.toml` をベースに構成します。
   - 管理画面（`apps/admin`）と Web サイト（`apps/web` が必要な場合）は Pages に接続し、Git 連携 + CI で自動デプロイする形にします。
2. **D1 データベースの準備**
   - Dashboard → ストレージとデータベース → D1 → Create database で環境に合わせたリージョンを選択。（今市情報でリージョンを勝手に選択されるみたい）
   - 作成後に `database_id` と `database_name` を控え、`apps/api/wrangler.toml` と CI の D1 バインディングに反映します。
3. **Turnstile の設定**
   - Cloudflare ダッシュボード → アプリケーション セキュリティ → Turnstile → ウィジェットを追加 で「管理画面用」「問い合わせフォーム用」など用途ごとに分けて作成。
   - 取得したサイトキーとシークレットキーは環境ごとに分離し、.envに追記。
4. **Resend の連携**
   - API KeysでAPIキーを取得、PermissionはSending Access、DomainはAll DomainsでAPIキーを.envとシークレットに`RESEND_API_KEY` として追記
   - WebhooksでWebhookを追加 Endpoint URLは`https://<worker-domain>/app/api/webhooks/resend`、Events typesは[email.bounced / email.complained / email.delivered / email.delivery_delayed / email.failed]。登録したらシークレットをコピーして.envの`RESEND_WEBHOOK_SECRET`に追記
   - ドメイン設定する時は[1.4 Resend ドメイン設定](#14-resend-ドメイン設定)
5. **Cron Job Secret**
   - Cloudflare Worker（または Pages Functions）のシークレットとして使う CRON_JOB_SECRET を
     「最低16文字以上のランダム英数字」で生成（openssl rand -base64 16）して`CRON_JOB_SECRET` として.envに登録
6. **R2（必要な場合）**
   - Cloudflare ダッシュボード → R2 でバケットを作成し、アクセスキー/シークレットキーを生成します。
   - バケットはプライベートに保ち、公開が必要な場合は署名付き URL のみを許可するよう `apps/api` 側の設定と合わせて調整します。
7. **Secrets / 環境変数の登録**
   - Worker 側: `bunx wrangler secret put JWT_SECRET` / `AUDIT_LOG_ENCRYPTION_KEY` / `RESEND_API_KEY` / `TURNSTILE_SECRET_KEY` / `CRON_JOB_SECRET` など、api/.envに書いてあるすべての秘密値を登録します。
   - Pages 側: Settings → Environment variables で `PUBLIC_API_BASE_URL`, `PUBLIC_ASSET_BASE_URL`, `VITE_PUBLIC_TURNSTILE_SITE_KEY` などadmin/.envの秘密値を登録します。
8. **Pages のビルド設定**
   - Admin: Build コマンド `bun install && bun run build`、Build output は `.svelte-kit/cloudflare`、ルートディレクトリは `apps/admin`。
   - Web を公開する場合は同様に `apps/web` を指定し、Build コマンドと出力ディレクトリ（`dist` など）を設定します。
9. **Cloudflare セキュリティ設定**
   - Security → WAF で SQLi / XSS / ファイルアップロード対策ルールを Block に設定し、Bot Fight Mode を必要に応じて有効化します。
   - Security → Firewall Rules で `/app/api/*` のアクセス許可元（IP / 国 / レート）を制限し、管理画面の利用 IP をホワイトリストで登録します。
   - Turnstile のキーは環境ごとに分け、Cloudflare Secret Manager / Pages 環境変数で一元管理・定期ローテーションします。
   - R2 はパブリックアクセスを最小化し、署名付き URL の期限短縮・オブジェクトライフサイクル・アクセスログ連携を設定します。
   - Workers / Pages から配信するレスポンスに HSTS / CSP / X-Content-Type-Options などのセキュリティヘッダーが付与されているか確認します。
10. **Wrangler ログイン確認**
    - ホスト OS で `cd apps/api && bunx wrangler whoami` を実行し、正しいアカウントで認証済みであることを確認します。

Wrangler は Cloudflare Workers 向けの公式 CLI（AWS でいう SAM CLI に相当）です。インストール方法や設定は [公式ドキュメント](https://developers.cloudflare.com/workers/wrangler/install-and-update/) を参照してください。

### 1.3 コマンド実行場所のルール

- **Wrangler**: 必ずホスト OS の `apps/api` ディレクトリで実行します。Docker コンテナからは Cloudflare 認証が通りません。
- **Prisma CLI**: `docker compose exec hono_api ...` から実行します（D1 アダプターが正しく読み込まれるため）。`hono_dev` コンテナでの Prisma 実行は禁止です。
- **Bun タスク**: ルート、または対象ワークスペースの直下で実行します。Docker 内で `bun dev` や `bun run lint` を動かす場合は `docker compose exec hono_dev bash` に入ってから実行してください。

### 1.4 Resend 連携設定（初回必須）

1. **送信ドメインの認証** — Resend ダッシュボード → Domains → Add Domain で自社ドメインを登録し、提示された TXT / CNAME / DKIM / MX を Cloudflare DNS に追加して `Verified` になるまで待ちます。
2. **本番運用** — 管理画面 `settings/contact` の送信元ドメインを認証済みのものに更新し、Resend ダッシュボードで `Delivered` まで確認します。

---

## 2. セットアップ手順

### STEP 1: リポジトリ取得

```bash
git clone <THIS-REPO>
cd hono
```

### STEP 2: `.env` をコピーして値を記入

```bash
cp apps/api/.env.example apps/api/.env
cp apps/admin/.env.example apps/admin/.env
cp apps/web/.env.example apps/web/.env
```

主に設定する値（アプリ別）

*apps/api/.env**

- `NODE_ENV`: `development`（ローカル）か `production`（本番）を指定します。Workers では必ず `production` をセットしてください。
- `API_BASE_URL`: API が公開される URL。ローカルは空でも構いませんが、本番は `https://<worker-domain>` を設定するとメール本文などで完全修飾 URL を組み立てられます。
- `API_PORT`: ローカル開発時に API が待ち受けるポート。Docker 構成のデフォルトは `8787` です。
- `DATABASE_URL`: Prisma の接続先。Cloudflare D1 バインディングを使う場合は空のままで問題ありません。ローカルでファイル DB を使う場合は `file:./dev.db` のように指定します。
- `ALLOWED_ORIGINS`: 管理画面や公開サイトなど、API へアクセスを許可するオリジンをカンマ区切りで列挙します（例: `http://localhost:5173,https://admin.example.com`）。
- `JWT_SECRET`: JWT 署名に使う共有シークレット。`openssl rand -base64 48` などで生成した推測困難な値を設定します。
- `AUDIT_LOG_ENCRYPTION_KEY`: 監査ログ内の機微情報を暗号化する鍵。`openssl rand -base64 32`などで作成した32 バイト相当のランダム文字列を使用し、定期的にローテーションしてください。
- `TURNSTILE_SECRET_KEY` / `TURNSTILE_SITE_KEY`: お問い合わせフォーム向け Turnstile のシークレットとサイトキー。環境別に分けて登録します。
- `LOGINS_TURNSTILE_SECRET_KEY` / `LOGINS_TURNSTILE_SITE_KEY`: 管理画面ログイン専用の Turnstile キー。一般フォーム用と分離することでリスクを低減します。
- `BYPASS_TURNSTILE`: 開発用途で Turnstile 検証を一時的に無効化したい場合のみ `"true"` にします。本番環境では必ず削除または空にしてください。
- `RESEND_API_KEY`: Resend の API キー。Resend ダッシュボードでドメイン認証後に発行し、`bunx wrangler secret put` で登録します。
- `RESEND_WEBHOOK_SECRET`: Resend Webhook の署名検証に用いるシークレット。ダッシュボードで生成し、Webhook 設定と合わせて管理します。
- `CRON_JOB_SECRET`: 最低16文字以上のランダム英数字で生成`openssl rand -base64 16`
- `CLOUDFLARE_ACCOUNT_ID`: R2 を利用する際のアカウント ID。Cloudflare ダッシュボードの「Workers & Pages > R2」から確認できます。
- `CLOUDFLARE_R2_ACCESS_KEY` / `CLOUDFLARE_R2_SECRET_KEY`: R2 の API キー。バケット単位の最小権限キーを発行します。
- `CLOUDFLARE_R2_BUCKET`: 利用するバケット名（例: `hono-uploads`）。Worker 側の設定と一致させてください。
- `CLOUDFLARE_R2_PUBLIC_BASE_URL`: 署名付き URL を配信する際のベース URL。公開バケットの場合は `https://pub-<hash>.r2.dev` のような形式になります。

*apps/admin/.env**

- `NODE_ENV`: 管理画面のランタイムモード。Cloudflare Pages では `production` を維持します。
- `ADMIN_BASE_URL`: 管理画面自身のベース URL。ローカルは `http://localhost:5173`、本番は `https://admin.example.com` のように設定します。
- `ADMIN_PORT`: ローカルサーバーのポート番号（デフォルト `5173`）。ポート衝突時に変更します。
- `ADMIN_API_PROXY_URL`: Cloudflare Pages から API を呼ぶ際のプロキシ URL。独自エッジやトンネルを経由する場合に設定し、不要なら空のままで問題ありません。
- `JWT_SECRET`: API 側と同じシークレットを設定し、セッション検証で整合性を確保します。
- `PUBLIC_API_BASE_URL`: ブラウザから API を呼び出す際のベース URL。必ず `/app/api` を含まない形で `https://api.example.com` のように設定し、ルートの `/app/api` プレフィックスが自動で付与される前提です。
- `PUBLIC_ASSET_BASE_URL`: R2 や CDN 上の公開アセットにアクセスするためのベース URL。画像などを外部配信する場合に設定します。利用しない場合は空で問題ありません。
- `VITE_PUBLIC_TURNSTILE_SITE_KEY`: 管理画面に埋め込む Turnstile のサイトキー。`LOGINS_TURNSTILE_SITE_KEY` と同じ値を参照する運用が一般的です。

*apps/web/.env**

- `NODE_ENV`: Astro サイトのモード。Pages にデプロイする際は `production` に固定します。
- `WEB_BASE_URL`: 公開サイトのベース URL（例: `https://www.example.com`）。Astro のリンク生成に利用されます。
- `WEB_BASE_PATH`: サイトをサブディレクトリ配信する場合のパス（例: `/marketing`）。ルート公開時は `/` のままで構いません。
- `PUBLIC_API_URL`: 本番環境からアクセスする API の完全な URL（例: `https://api.example.com/app/api`）。必ず `/app/api` まで含めて設定します。
- `PUBLIC_API_URL_DEV`: ローカル開発時に利用する API URL（例: `http://localhost:8787/app/api`）。Docker で動かす場合は `http://hono_api:8787/app/api` を指定するとサービス間通信が安定します。
- `PUBLIC_TURNSTILE_SITE_KEY`: Web サイトで利用する Turnstile のサイトキー。フォーム用途ごとに環境別のキーを設定してください。

### STEP 3: Docker コンテナを起動

```bash
docker compose up -d
```

- `hono_api`: API サーバー (`bun --watch src/server.ts`)
- `hono_admin`: SvelteKit 管理画面
- `hono_web`: Astro サイト
- `hono_dev`: 開発用シェル / Storybook / Turborepo タスク用

### STEP 4: 動作確認

- API Swagger: [http://localhost:8787/swagger](http://localhost:8787/swagger)
- 管理画面: [http://localhost:5173](http://localhost:5173)
- Web サイト: [http://localhost:4321](http://localhost:4321)
- Storybook: `docker compose exec hono_dev bun storybook` → [http://localhost:6006](http://localhost:6006)

### STEP 5: Lint / テスト

```bash
docker compose exec hono_dev bash
bun run lint
bun run test
```

必要に応じて `bun run test:admin` や `bun run test:e2e` も実行します。

---

## 3. 日常開発でよく行う操作

| 操作 | コマンド例 | 備考 |
| --- | --- | --- |
| コンテナ起動 / 停止 | `docker compose up -d` / `docker compose down` | |
| ログ確認 | `docker compose logs -f hono_api` | サービス名を変更して利用 |
| 再起動 | `docker compose restart hono_admin` | |
| Prisma の状態確認 | `docker compose exec hono_api bunx prisma migrate status` | スキーマ差分を確認 |
| Prisma Client 再生成 | `docker compose exec hono_api bunx prisma generate` | `schema.prisma` 変更時に必須 |
| 初期データ再投入 | `docker compose exec hono_api bunx prisma db seed` | `apps/api/prisma/seed.ts` を実行 |
| Storybook 起動 | `docker compose exec hono_dev bun storybook` | [http://localhost:6006](http://localhost:6006) |
| Workers ログ監視 | `bunx wrangler tail --env production --format pretty --metrics --sampling-rate 1` | ホスト `apps/api` で実行 |

> スキーマを変更しない限り、`prisma migrate` を実行する必要はありません。通常の開発では「コード修正 → lint/test → 動作確認」で十分です。

---

## 4. デプロイ手順

### 4.1 初回デプロイ（D1 初期化を含む）

1. **Wrangler へログイン**

    ```bash
      cd apps/api
       bunx wrangler login
    ```

2. **Cloudflare Secrets を登録**（ホスト側 `apps/api`）

    ```bash
       bunx wrangler secret put JWT_SECRET
       bunx wrangler secret put AUDIT_LOG_ENCRYPTION_KEY
       bunx wrangler secret put RESEND_API_KEY
       # 必要に応じて TURNSTILE_* や CLOUDFLARE_R2_* も登録
    ```

3. **必要ならマイグレーション作成**

    ```bash
       docker compose exec hono_api bunx prisma migrate dev --name init
       docker compose exec hono_api bunx prisma generate
    ```

4. **D1 に適用**

    ```bash
       cd apps/api
       bunx wrangler d1 migrations apply <DB_NAME> --remote
    ```

5. **シード実行（任意）**

    ```bash
       docker compose exec hono_api bunx prisma db seed
    ```

6. **Workers をデプロイ**

    ```bash
       cd apps/api
       bunx wrangler deploy
    ```

7. **Pages（管理画面 / Web）**

   - GitHub 連携または Deploy Hook で `bun install && bun run build` を実行し、Cloudflare Pages へアップロードします。

### 4.2 2 回目以降（DB 変更なし）

1. 最新コードを取得し、ローカルで `bun run lint` / `bun run test`
2. （任意）`docker compose exec hono_api bunx prisma migrate status`
3. ホスト側 `apps/api` で `bun run build` → `bunx wrangler deploy`
4. Pages をデプロイ（GitHub Actions など）
5. `bunx wrangler tail --env production --format pretty --metrics --sampling-rate 1` で 10〜15 分程度ログ監視

### 4.3 DB スキーマ変更あり（カラム / テーブル追加）

1. Prisma スキーマ修正: `apps/api/prisma/schema.prisma`
2. マイグレーション作成 / クライアント再生成

    ```bash
      docker compose exec hono_api bunx prisma migrate dev --name <migration-name>
      docker compose exec hono_api bunx prisma generate
      docker compose exec hono_api bunx prisma migrate status
    ```

3. マイグレーション SQL をコミットに含める

4. ローカル D1 で検証

    ```bash
      cd apps/api
      bunx wrangler d1 migrations apply <DB_NAME> --local
    ```

5. リモート D1 に適用 → テーブル確認

    ```bash
      bunx wrangler d1 migrations apply <DB_NAME> --remote
      bunx wrangler d1 execute <DB_NAME> --remote --command "SELECT name FROM sqlite_master WHERE type='table';"
    ```

   - 期待するテーブル（例: `Post`, `Category`, `PostSetting` など）が欠損していないかログを確認します。欠損がある場合はデプロイを中断してください。

6. 必要に応じてシードを再実行

    ```bash
      docker compose exec hono_api bunx prisma db seed
    ```

7. Workers デプロイ → Pages デプロイ → `bunx wrangler tail ...` で最終確認

> `apps/api/prisma/check-critical-tables.sql` は必須テーブル名を維持するための参考 SQL です。自動化時は上記の `SELECT name FROM sqlite_master ...` コマンドで常に安全にチェックできます。

---

## 5. トラブルシューティング

| 症状 | 対処 |
| --- | --- |
| `DOMParser is not defined` | `apps/api/src/polyfills/dom-parser.ts` を確認し、`bun install --cwd apps/api` → `docker compose restart hono_api` |
| `no such table: main.Post` など | リモート D1 にマイグレーションが未適用。`bunx wrangler d1 migrations apply <DB_NAME> --remote` → `bunx wrangler d1 execute <DB_NAME> --remote --command "SELECT name FROM sqlite_master WHERE type='table';"` で確認 |
| `No migrations to apply!` だがテーブル欠損 | `docker compose exec hono_api bunx prisma migrate status` で差分を確認し、必要に応じて `wrangler d1 migrations create` を利用 |
| Turnstile / Resend エラー | Secrets と Pages 環境変数を再確認。Resend はドメイン Verify 状態か要チェック |
| Pages が 500 | `PUBLIC_API_BASE_URL` や `PUBLIC_ASSET_BASE_URL` が未設定。Pages ダッシュボードと `apps/admin/src/hooks.server.ts` を確認 |
| ローカルから API へ接続できない | Docker ネットワークで `http://hono_api:8787` に到達できるか、`.env` の `ALLOWED_ORIGINS` に該当ドメインが含まれているかを確認 |

> マイグレーションがどうしても適用できない場合は、開発環境に限り `wrangler d1 delete` → `wrangler d1 create` → 全 SQL を結合した `wrangler d1 execute --file` → `wrangler deploy` でリセットできます。データ損失に注意してください。

---

お問い合わせは Issue や PR でお知らせください 🙌
