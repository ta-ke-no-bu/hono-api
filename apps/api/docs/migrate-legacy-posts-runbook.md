# `migrate-legacy-posts` Runbook

投稿テンプレート移行スクリプト（`apps/api/scripts/migrate-legacy-posts.ts`）と既定テンプレート `post-default` の復旧手順をまとめたランブックです。テンプレート無し投稿フローが 409 / 424 を返した際は本手順に沿って復旧してください。

---

## 1. 発生の兆候

- 監視アラート: `post-default missing or inactive`（Slack 通知）
- API レスポンス: テンプレート無し投稿で HTTP 409（無効）または 424（欠損）
- 管理画面: デフォルトフォーム送信時に「既定テンプレートを復旧してください」のトースト表示

---

## 2. 事前チェック

1. **環境の確認**  
   対象ワークロード（staging / production）を特定し、必要に応じてメンテナンス通知を出します。
2. **コンテナ接続準備**  
   `docker compose exec -it hono_api bash` でコンテナに入り、`cd /app/apps/api` へ移動してから以下のコマンドを実行します。
3. **現在のテンプレート状態を確認**

```bash
bunx prisma db execute --stdin <<'SQL'
SELECT id, slug, status, updatedAt FROM PostSetting WHERE slug = 'post-default';
SQL
```

- 結果が 0 件 → 欠損
- `status = INACTIVE` → 無効化
- `status = ACTIVE` → 正常（他要因を調査）

---

## 3. 復旧手順

### 3.1 既定テンプレートを再作成／有効化

最も簡単なのは移行スクリプトを再実行する方法です。`ensureDefaultPostSetting` が欠損時に自動作成し、既存の場合は何もしません。

```bash
bunx ts-node scripts/migrate-legacy-posts.ts
```

- 実行ログに `投稿テンプレート移行が完了しました。` が表示されれば成功です。
- 既存投稿が更新される可能性があるため、実行前に主要な投稿の backup/export を取得しておくと安全です。

### 3.2 状態が `INACTIVE` の場合のみ有効化したいとき

`post-default` が存在し `status = INACTIVE` の場合は、Prisma で有効化します。

```bash
bunx ts-node -e "\
import { PrismaClient } from '@prisma/client';\
const prisma = new PrismaClient();\
prisma.postSetting.update({ where: { slug: 'post-default' }, data: { status: 'ACTIVE' } })\
  .finally(() => prisma.$disconnect())\
  .catch((error) => { console.error(error); process.exit(1); });\
"
```

---

## 4. 検証

1. テンプレート状態の再確認（前述 SQL を再実行し `ACTIVE` か確認）。
2. 管理画面 → `/posts/new` でデフォルトフォームが送信できるかテスト。
3. API テストを実行  
   `hono_api` コンテナ内で次を実行し、完了後に `exit` でコンテナを抜けます。

   ```bash
   bun test --filter "post without template"
   ```

4. 管理画面 E2E テストを実行  
   ホスト側から以下を実行します。

   ```bash
   docker compose exec hono_admin bun test:admin --grep 'post without template'
   ```

5. Slack 監視通知が自動復旧として閉じられたか確認。

---

## 5. 失敗時のエスカレーション

- スクリプト実行が連続で失敗する場合は以下を確認:
  - D1 / SQLite の接続状態（`docker compose logs hono_api`）
  - Prisma マイグレーションの最新化（`docker compose exec hono_api bunx prisma migrate status`）
- 復旧できない場合は SRE 担当へ連絡し、手動で `PostSetting` テーブルへ新規行を挿入します（CUID の生成は `bunx nanoid --size 24` などを利用）。

---

## 6. 関連ドキュメント

- 投稿設定仕様: ルート `post-groupe-spec.md`
- 管理マニュアル: `apps/admin/README.md`
- スクリプト実装: `apps/api/scripts/migrate-legacy-posts.ts`
