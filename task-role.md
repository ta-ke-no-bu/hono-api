# 会員管理機能 拡張指示書
最終更新: 2025-10-27

## 概要
- 会員管理まわりのロール設計・認証強化・監査運用を統合的に整えるための指針です。
- 対象システム: Cloudflare Workers 上の Hono API (`apps/api`) と SvelteKit 管理画面 (`apps/admin`)。

## 現在の実装状況（2025-10-27 時点）

### バックエンド（apps/api）
- Prisma `User` モデル（`apps/api/prisma/schema.prisma`）には `email`, `password`, `failedLoginAttempts`, `lockUntil` などが存在し、ロールやアカウント状態を示す列は未実装。
- 認証フロー（`apps/api/src/routes/auth.ts` / `apps/api/src/services/auth.ts`）では Turnstile 検証、12 文字以上で大小英字・数字・記号を含むパスワードポリシー、bcrypt(10) によるハッシュ化、5 回失敗で 30 分ロック、監査ログ (`createAuditLog`) への記録が行われている。
- ログイン成功時は 1 時間有効な JWT を発行して Cookie `session` に保存。ロック解除 API や通知、ロール判定は未実装。
- `users` ルート（`apps/api/src/routes/users.ts`）は一覧/取得/更新/削除のみ提供し、新規作成 API やロール別のアクセス制御は存在しない。
- 監査ログユーティリティ（`apps/api/src/utils/auditLog.ts`）は AES-256-GCM で詳細を暗号化し、`AUDIT_LOG_ENCRYPTION_KEY` を 32 文字以上に制約している。

### 管理画面（apps/admin）
- 会員一覧（`apps/admin/src/routes/users/+page.svelte`）と詳細編集（`apps/admin/src/routes/users/[id]/+page.svelte`）はメールアドレス・氏名のみ編集可。ロール表示/変更 UI やユーザー追加画面は未実装。
- 管理画面全体でロールによるメニュー制御や画面制限は導入されていない。

### 既知の課題
- データモデル/認証層にロール概念がないため、API と UI の最小権限制御が実現できていない。
- アカウントロックは実装済みだが、通知・解除フロー・運用ドキュメントが不足。
- 管理者がユーザーを追加/譲渡/ロック解除するための UI と API が欠落。
- パスワードリセット、MFA、再認証などの高リスク操作制御が未整備。
- PII を含む問い合わせデータ管理やサービスアカウント運用ルールが未定義。

## ロールと権限制御ポリシー

| ロール | 利用可能機能 | 制限・備考 |
| ------ | ------------ | ---------- |
| **admin** | すべての管理機能（ユーザー追加／編集／削除／ロール変更、投稿設定、フォーム管理、メール設定、ログ閲覧など） | admin アカウントは 1 名のみ。ユーザー追加およびメール設定は admin のみ実行可能。 |
| **editor** | 投稿設定・投稿管理・フォーム管理（閲覧・編集・削除は editor まで）・ログ閲覧（閲覧は admin/editor のみ）・ユーザー編集／削除 | ユーザー追加不可／メール設定不可。問い合わせ削除・フォーム管理は editor まで。 |
| **general** | ダッシュボード・投稿管理（一覧／詳細／編集／削除・テンプレート選択・カテゴリ追加）・問い合わせ一覧／詳細（削除不可）・ヘルプ | 会員詳細の閲覧不可。投稿設定／フォーム管理／ユーザー管理／メール設定／ログ閲覧は不可。 |

- ロールは `admin` / `editor` / `general` の 3 値。新規登録時のデフォルトは `general` とする。
- API とフロントエンド双方でロールに基づくアクセス制御を強制し、UI の制御だけに依存しない。
- ロール昇格（general/editor → admin）は多要素確認を必須とし、監査ログと通知を必ず残す。

## 実装ポリシー
- すべての入力は Zod + OpenAPI (`createRoute`) で検証し、バックエンドでの権限チェックを必須化する。
- `createAuditLog` による監査ログ記録を高リスク操作で徹底し、暗号化済み詳細に操作主体・対象・コンテキストを保存する。
- Resend・Turnstile など既存の外部サービスを活用して通知フローを構築する。
- 実装後は `bun lint` / `bun test` / `bun test:admin` / `bun test:e2e` を通し、Swagger (`/swagger`) でエンドポイント公開状態を検証する。

## 対応優先度とタスク

### P0 前準備: Prismaモデル / マイグレーション方針
- **目的**: ロール基盤実装に先立ち、スキーマ変更と移行手順を明確化してダウンタイムと運用リスクを最小化する。
- **対象ファイル**: `apps/api/prisma/schema.prisma`, `apps/api/prisma/migrations/**`, `apps/api/prisma/seed.ts`
- **適用順序**:
  1. **スキーマ拡張**
     - `enum UserRole { ADMIN EDITOR GENERAL }` を追加。
     - `User` モデルへ `role UserRole @default(GENERAL)`、`roleAssignedAt DateTime @default(now())` を追加（昇格監査用）。
     - `@@index([role], map: "idx_user_role")` を追加し、ロール別クエリを最適化。
  2. **部分ユニーク制約（単一 admin の担保）**
     - Prisma のマイグレーション SQL に手動で以下を追記し、D1/SQLite で `ADMIN` に限定したユニーク制約を付与。
       ```sql
       CREATE UNIQUE INDEX "User_single_admin" ON "User"("role") WHERE "role" = 'ADMIN';
       ```
     - Prisma スキーマでは表現できないため、マイグレーション SQL を手動編集（Prisma 生成後に追記）し、再生成時は差分に注意。
  3. **データ移行**
     - 既存レコードを `GENERAL` に更新する SQL をマイグレーションに含める。
       ```sql
       UPDATE "User" SET "role" = 'GENERAL', "roleAssignedAt" = CURRENT_TIMESTAMP WHERE "role" IS NULL;
       ```
     - 本番/ステージング移行時は、実際の管理者アカウント 1 件を手動で `ADMIN` に更新するスクリプト（例: `UPDATE "User" SET "role"='ADMIN' WHERE email='<admin-email>';`）を準備。
     - 万一 `ADMIN` が複数存在した場合でもトランザクション内でエラーが発生するようにし、アプリケーション側でハンドリングする。
  4. **Seed 更新**
     - `apps/api/prisma/seed.ts` の初期ユーザーに `role: 'ADMIN'` と 12 文字以上・複雑度を満たす開発用パスワード（例: `Dev#Admin1234`）を設定。
     - 既存 seed 実行時に `roleAssignedAt` を自動反映させるため、`create`/`upsert` に `role` を明示する。
  5. **Prisma クライアント再生成**
     - `docker compose exec hono_api bunx prisma generate` を実行し、新しい enum/フィールドをクライアントへ反映。
  6. **検証手順**
     - ローカル: `bunx prisma migrate dev --name add_user_role` → `bun test` → `bun test:admin`。
     - Cloudflare D1: `bunx wrangler d1 migrations apply <DB_NAME> --remote` で適用可否を確認。
     - 既存 `User` データをダンプし、ロール付与状況と `User_single_admin` の動作（`INSERT`/`UPDATE` シミュレーション）を QA。

### P0: ロール基盤の実装
- [ ] **ロール付与・権限チェックと監査**
  - 現状: `authMiddleware` は JWT のみ検証し、`Context` にロール情報が存在しない。`User` モデルにもロール列がない。
  - 対応: Prisma に `enum UserRole { ADMIN, EDITOR, GENERAL }` と `role` フィールドを追加し、各 API で `c.get('user')` のロールに基づくアクセス制御を実装。権限不足時は 403 を返し、`createAuditLog(... 'FORBIDDEN')` を記録する。
- [ ] **新規登録時のデフォルトロール適用**
  - 現状: `registerUser` はロール未設定でユーザーを作成する。
  - 対応: DB デフォルトおよびサービス層で `general` を強制し、admin UI からの昇格フローを定義する。
- [ ] **一般ユーザーの機能範囲を実装で確認**
  - 現状: 管理画面で全メニューにアクセスでき、API 側も制限がない。
  - 対応: ナビゲーションやルーティングをロールで出し分け、API も同等の制御を実施。権限不足時の UX と監査ログを整備する。
- [ ] **ユーザー追加機能の実装**
  - 現状: API/UI ともにユーザー追加フローが存在しない。
  - 対応: admin 専用の招待/追加 API と UI を実装し、初期パスワード発行、Resend 経由の通知、監査ログ記録を追加する。
- [ ] **admin 権限の譲渡フロー実装**
  - 現状: admin の人数制約や譲渡機能が未実装。
  - 対応: admin → 別ユーザーへの譲渡 API/UI を用意し、パスワード再入力 + メール確認などの多段認証を必須化。譲渡後は旧 admin を editor に降格し、監査ログ・通知を送信する。
- [ ] **フォーム／メール設定のアクセス方針反映**
  - 現状: `apps/admin/src/routes/settings/contact/forms/+page.svelte` などでロール制御がない。
  - 対応: editor までがフォーム管理・ログ閲覧を操作できるよう制限し、メール設定は admin のみに限定。API 側でもロールチェックを実装する。
- [ ] **問い合わせ・フォームデータの取り扱い制限**
  - 現状: `apps/api/src/services/contact.ts` で PII マスキングやロール別制限が未実装。
  - 対応: PII 項目のマスキング/フィルタリング、ロール別アクセス制御、エクスポート操作の監査を追加する。
- [ ] **サービスアカウント／API トークンの最小権限化**
  - 現状: サービスアカウント設計が未定義。
  - 対応: バッチ・外部連携用アカウントを一般ユーザーと分離し、専用ロールまたはスコープを設計して最小権限を徹底する。

### P1: 認証・パスワード運用
- [ ] **パスワードポリシーとリセット運用の整備**
  - 現状: 12 文字 + 大小英字 + 数字 + 記号の検証はあるが、履歴管理・初期パスワード無効化・運用手順が未整備。
  - 対応: ポリシーを `Readme.md`/`role.md` に明記し、初期パスワード強制変更、リセット通知（メール + 監査）、履歴チェックを実装する。
- [ ] **パスワード変更機能の追加**
  - 現状: 管理 UI・API に再設定機能がない。
  - 対応: admin/editor が権限内ユーザーを再設定できる UI/API を追加し、本人通知・監査・Turnstile・再認証を組み込む。
- [ ] **失敗検知とロック運用**
  - 現状: 5 回失敗でロックするが、通知・解除フロー・閾値設定がない。
  - 対応: 失敗通知メール、ロック解除申請フロー、閾値/ロック時間の設定管理を導入し、対応手順を文書化する。
- [ ] **権限変更時の対象ユーザー通知**
  - 現状: ロール変更 API がないため通知も未実装。
  - 対応: ロール変更処理に対象ユーザーへのメール通知と監査ログ（旧ロール/新ロール/操作者）を追加する。
- [ ] **高リスク操作における再認証／MFA**
  - 現状: ロール譲渡や設定変更で追加認証がない。
  - 対応: パスワード再入力 + TOTP/WebAuthn など MFA を導入し、admin ログイン・権限譲渡・パスワードリセットで必須化する。
- [ ] **admin 不在時の復旧手順を整備**
  - 現状: admin 消失時の復旧プロセスが未整備。
  - 対応: 緊急時の昇格手順（CLI/SQL/サポートルート）を策定し、監査ログを伴う運用ドキュメントを作成する。
- [ ] **セッション・トークンの有効期限管理**
  - 現状: JWT は 1 時間固定でリフレッシュやローテーションがない。
  - 対応: リフレッシュトークン導入または定期再認証ポリシーを策定し、Cookie 属性 (`Secure`, `SameSite`) の本番設定を再確認する。
- [ ] **ログイン／ロック関連イベントの監査**
  - 現状: `LOGIN_SUCCESS`/`LOGIN_FAILED`/`ACCOUNT_LOCKED` は記録されるが、ロック解除や解除失敗の追跡がない。
  - 対応: 解除イベント・担当者・閾値変更を監査ログに追加し、分析しやすいメタデータ（IP, User-Agent, 試行回数）を揃える。

### P2: 運用・監査プロセス
- [ ] **重要操作のダブルチェック運用**
  - 現状: ユーザー削除やフォーム削除が単独操作で完了する。
  - 対応: 二重承認ワークフローやレビュー手順を策定し、監査ログ/通知と連携させる。

## 運用メモ
- 上記タスクを進める際は Prisma のマイグレーションを `docker compose exec hono_api bunx prisma migrate dev` で実施し、`apps/api/prisma` を単一の信頼ソースとして扱う。
- 実装後は `bun lint` → `bun test` → `bun test:admin` → `bun test:e2e` の順でセルフチェックし、Swagger ドキュメントを更新する。
- 変更点は `Readme.md` や本ファイルを必ず同期させ、運用チームと共有する。
