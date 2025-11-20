# API鍵・シークレットのローテーション手順

本書では Resend / Cloudflare Turnstile / Cloudflare R2 / JWT シークレットなど、メール送信および認証まわりで利用する主要キーのローテーション方法を整理します。少なくとも四半期に一度、または漏えいの疑いがある場合にはただちに実施してください。

## 共通準備

- `.env`（ローカル）と Cloudflare Secrets（本番）に格納されている最新値を確認し、回収忘れを防ぐ。
- 切り替え作業はメンテナンス時間帯に行い、完了後に Smoke Test を実施する。

## Resend （メール送信）

1. Resend ダッシュボード > **Webhooks** で新しい Signing Secret を生成。
2. `RESEND_WEBHOOK_SECRET` を Cloudflare Secrets と `.env` に更新。
3. `RESEND_API_KEY` を更新する場合は、Resend の API Keys で新規発行 → `.env` / Cloudflare Secrets に反映。
4. デプロイ後、`/app/api/webhooks/resend` に対して Resend の Test Webhook を送信し、署名検証とメール送信が成功することを確認。
5. 旧キーを Resend 側で revoke し、廃棄記録を残す。

## Cloudflare Turnstile

1. Turnstile ダッシュボードで新しい Site Key / Secret Key を作成。
2. `TURNSTILE_SITE_KEY` / `TURNSTILE_SECRET_KEY` を `.env` と Cloudflare Secrets に更新。
3. ログイン API（`/app/api/auth/login`）とお問い合わせフォームから Turnstile が通ることを手動確認。
4. 旧キーを Turnstile 側で無効化し、記録を残す。

## Cloudflare R2

1. Cloudflare ダッシュボード > R2 > **API Tokens** で新しい Access Key / Secret を生成。
2. `CLOUDFLARE_R2_ACCESS_KEY` / `CLOUDFLARE_R2_SECRET_KEY` を `.env` と Cloudflare Secrets に更新。
3. 署名付き URL が再発行できることを API (`POST /app/api/uploads/*`) で確認。
4. 旧キーを削除し、アクセスログに異常がないことを確認。

## JWT シークレット / 監査ログ暗号化キー

1. OpenSSL 等で 32 バイト以上のランダム値を生成。
2. `JWT_SECRET` および `AUDIT_LOG_ENCRYPTION_KEY` を `.env` / Cloudflare Secrets に更新し、`bun test` で既存セッションが無効化されることを確認。
3. ログインが正常に行えることを手動確認。

## Cron Job Secret

1. Cloudflare Pages/Workers の環境変数にて新しい `CRON_JOB_SECRET` を生成し、最低 16 文字以上のランダム英数字を設定する。
2. 同じ値を `.env` に反映し、`/app/api/jobs/email-retry` 呼び出し時に `X-Cron-Secret` へ送る値を更新。
3. 新しいシークレットでジョブが実行でき、旧シークレットで 403 になることを確認。
4. 運用ドキュメントとスケジューラ設定を更新し、旧シークレットを破棄する。

## 手順実行後

- `docs/security/key-rotation.md` にローテーション実施日と担当者を追記。
- 必要であれば監査ログにメタ情報を記録。
- 旧キーが参照されていないことを 24 時間以内に再度確認。
