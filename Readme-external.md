# 外部AstroプロジェクトからHono APIを利用するための実装ガイド

## 目次

- [1. はじめに](#1-はじめに)
  - [目的](#目的)
  - [前提条件](#前提条件)
- [2. 外部 Astro プロジェクトの準備](#2-外部-astro-プロジェクトの準備)
  - [2.1 推奨ディレクトリ構成](#21-推奨ディレクトリ構成)
  - [2.2 環境変数](#22-環境変数)
- [3. Hono API 仕様の要点](#3-hono-api-仕様の要点)
  - [3.1 利用するエンドポイント](#31-利用するエンドポイント)
  - [3.2 フォーム定義レスポンス例](#32-フォーム定義レスポンス例)
  - [3.3 問い合わせ送信リクエスト](#33-問い合わせ送信リクエスト)
  - [3.4 レスポンス](#34-レスポンス)
- [4. 実装ガイド](#4-実装ガイド)
  - [4.1 API ユーティリティ (`src/lib/contact/common/api.ts`)](#41-api-ユーティリティ-srclibcontactcommonapits)

## 1. はじめに

### 目的

このドキュメントは、既存の Hono API と Admin アプリケーションを維持しつつ、新規に構築する外部プロジェクト（例: コーポレートサイトのお問い合わせページやブログサイト）から Hono API を安全かつ確実に呼び出すための手順をまとめたものです。お問い合わせフォームについては、フォーム項目は外部プロジェクト側で管理し、Admin ではフォームのメタ情報（名称・スラッグ・通知・自動返信テンプレートなど）のみを編集する運用を前提とします。ブログ・お知らせ投稿については、公開APIを通じて記事一覧や詳細を取得できます。

### 前提条件

- Hono API (`apps/api`) と Admin アプリケーション (`apps/admin`) が本番またはローカルで稼働していること。
- API には CSP / JWT / rateLimit / CSRF が有効になっていること（本リポジトリの既定設定）。
- Cloudflare Turnstile を利用する場合は、Cloudflare 側でサイトキーが発行済みであること。
- Node.js と Bun がインストールされた開発環境があり、Docker コンテナ内で作業できること。
- Hono API 側の `apps/api/.env` で、このアプリのドメイン（本番・ローカル両方）が `ALLOWED_ORIGINS` に登録されていること。
  - 例: `ALLOWED_ORIGINS=https://example.com,http://localhost:4321`
- お問い合わせフォーム項目のマスタは API 側の `apps/api/src/config/contactFormDefinitions.ts` で管理しています。運用・更新手順は [`Readme.md`](../Readme.md#お問い合わせフォーム定義の管理) を参照してください。
- 投稿（お知らせ・ブログ記事等）は Admin インターフェースから管理可能です。公開投稿は認証不要で `/app/api/posts/public` から取得できます。

***

## 2. 外部 Astro プロジェクトの準備

### 2.1 推奨ディレクトリ構成

```plaintext
my-astro-project/
├── src/
│   ├── components/
│   │   └── contact/
│   │       └── ContactForm.svelte          # mountContactFormPageコンポーネント（Svelte 版）
│   ├── lib/
│   │   ├── contact/                        # お問い合わせ関連
│   │   │   ├── common/
│   │   │   │   ├── api.ts                  # fetchContactFormMetadata / submitContactForm
│   │   │   │   ├── definitions.ts          # フィールド型とユーティリティ
│   │   │   │   └── mount.ts                # mountContactFormPage（vanilla JS 版）
│   │   │   ├── inquiry/
│   │   │   │   └── init.ts                 # お問い合わせページ用エントリ
│   │   │   └── recruit/
│   │   │       └── init.ts                 # 採用フォーム用エントリ
│   │   ├── posts/                          # お知らせ・投稿関連（新規追加）
│   │   │   └── api.ts                      # fetchPublicPosts / fetchPublicPostById
│   │   └── utils/                          # 共通ユーティリティ（新規追加）
│   │       └── api.ts                      # getApiBaseUrl ヘルパー
│   ├── pages/
│   │   ├── contact/
│   │   │   ├── index.astro                 # 通常のお問い合わせページ
│   │   │   └── recruit/
│   │   │       └── contact.astro           # 採用問い合わせページ
│   │   ├── posts/
│   │   │   ├── index.astro                 # お知らせ一覧ページ（新規）
│   │   │   └── [id].astro                  # お知らせ詳細ページ（新規、オプション）
│   │   └── index.astro                     # トップページ
│   └── utils/
│       └── turnstileClient.ts              # Turnstile ヘルパー
└── .env
```

### 2.2 環境変数

`.env`（または `.env.local`）で以下を設定します。いずれも Astro から参照できるよう `PUBLIC_` プレフィックスを利用します。

```env
# Hono API のベース URL（本番）
PUBLIC_API_URL=https://your-hono-api-domain.com/app/api
# ローカル開発用 URL（Docker コンテナから API を呼び出す場合）
PUBLIC_API_URL_DEV=http://hono_api:8787/app/api
# Cloudflare Turnstile サイトキー
PUBLIC_TURNSTILE_SITE_KEY=your-turnstile-site-key
```

**重要**: Docker compose環境では `http://hono_api:8787/app/api` を使用してください。これは Docker 内部ネットワークで API コンテナに直接アクセスします。

補足:

- Turnstile 検証をローカルで一時的にスキップする場合のみ、API 側 `apps/api/.env` に `BYPASS_TURNSTILE=true` を設定し、本番では必ず削除または `false` に戻してください。
- CORS は API 側の `ALLOWED_ORIGINS` によって制御しています。新しい Astro ドメインを追加したら API を再起動してください。
- Astro 側ではフォームスラッグをキーにした入力項目定義（JSON や TypeScript）を保持します。項目の変更・追加は Astro プロジェクトで実施し、Admin 側ではメタ情報のみを更新してください。

***

## 3. Hono API 仕様の要点

### 3.1 利用するエンドポイント

#### お問い合わせ関連

| メソッド | パス | 用途 |
|----------|------------------------------|------------------------------|
| GET | `/app/api/contact/forms/public/:slug` | フォームのメタ情報取得（フォーム名、成功メッセージ、返信先スラッグなど） |
| POST | `/app/api/contact` | 問い合わせ送信（Turnstile 検証・入力値検証・Resend での通知を実行） |

#### お知らせ・投稿関連 (公開API、認証不要)

| メソッド | パス | 用途 |
|----------|------------------------------|------------------------------|
| GET | `/app/api/posts/public` | 公開投稿一覧取得（認証不要／カテゴリ・投稿設定 slug・キーワードでフィルタ可能／`customFields` と `customFieldSet.definitions` を含む） |
| GET | `/app/api/posts/public/:id` | 公開投稿詳細取得（認証不要／ID または詳細 slug を指定、`customFields`・`customFieldSet` を含む） |

> 投稿 API は `postSettingId` と `customFields` を受け付け、テンプレート（投稿設定）で定義したフィールド構成に基づいて動的に検証・保存を行います。公開 API のレスポンスには、入力値を正規化した `customFields` と、同じテンプレートに紐づくフィールド定義ツリー `customFieldSet` が含まれます。外部プロジェクトでは `customFieldSet.definitions` を巡回してフィールドタイプや選択肢を確認し、対応する UI で安全に描画してください。

### 3.2 フォーム定義レスポンス例

```json
{
  "id": "clx0...",
  "name": "お問い合わせ",
  "slug": "default",
  "description": "サイト共通フォーム",
  "successMessage": "送信を受け付けました。",
  "replyToFieldSlug": "email"
}
```

### 3.3 問い合わせ送信リクエスト

スキーマ（Zod 定義 `contactSubmissionRequestSchema`）:

```json
{
  "formSlug": "default",
  "values": {
    "name": "山田太郎",
    "topic": "product",
    "message": "資料を希望します"
  },
  "turnstileToken": "CF_TURNSTILE_TOKEN"
}
```

- `values` は Astro 側で定義しているフォーム項目のスラッグをキーにした連想配列です。複数選択フィールド（CHECKBOX）は文字列配列、その他は文字列／数値を送ります。
- Hono 側では各フィールドのバリデーション・XSS サニタイズを実施します。必須項目を欠落させると 422 応答になります。

### 3.4 レスポンス

成功時:

```json
{
  "success": true,
  "message": "お問い合わせが正常に送信されました",
  "contactId": "clx0...",
  "successMessage": "送信を受け付けました。"
}
```

Turnstile 失敗時は 403、存在しない `formSlug` は 404、バリデーションエラーは 422 が返却されます。

***

## 4. 実装ガイド

### 4.1 API ユーティリティ (`src/lib/contact/common/api.ts`)

問い合わせページから Hono API を呼び出すコードは `src/lib/contact/common/api.ts` に集約します。フォームメタ情報の取得と送信処理だけでなく、`FormData` から payload を生成するヘルパーもここで提供します。

```ts
// src/lib/contact/common/api.ts
import type { ContactFieldDefinition } from './definitions'
import { getApiBaseUrl } from '../utils/api'

export type ContactFormMetadata = {
  id: string
  name: string
  slug: string
  description?: string | null
  successMessage?: string | null
  replyToFieldSlug?: string | null
  turnstileEnabled?: boolean
}

export const fetchContactFormMetadata = async (slug: string): Promise<ContactFormMetadata> => {
  const response = await fetch(`${getApiBaseUrl()}/contact/forms/public/${slug}`)
  if (!response.ok) {
    throw new Error(`フォーム情報の取得に失敗しました (${response.status})`)
  }
  return (await response.json()) as ContactFormMetadata
}

export const submitContactForm = async (payload: {
  formSlug: string
  values: Record<string, unknown>
  turnstileToken: string
}) => {
  const response = await fetch(`${getApiBaseUrl()}/contact`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(payload),
  })

  const result = await response.json().catch(() => ({ message: 'Unexpected error' }))
  if (!response.ok) {
    throw new Error(result?.message ?? `送信に失敗しました (${response.status})`)
  }
  return result as { successMessage?: string | null; message?: string | null }
}

export const buildSubmissionValues = (
  fields: ContactFieldDefinition[],
  formData: FormData,
): Record<string, unknown> => {
  const result: Record<string, unknown> = {}

  for (const field of fields) {
    switch (field.type) {
      case 'CHECKBOX': {
        const values = formData.getAll(field.slug).map((item) => String(item))
        if (values.length > 0) {
          result[field.slug] = values
        }
        break
      }
      case 'NUMBER': {
        const raw = formData.get(field.slug)
        if (raw !== null && raw !== '') {
          const parsed = Number(raw)
          if (!Number.isNaN(parsed)) {
            result[field.slug] = parsed
          }
        }
        break
      }
      default: {
        const value = formData.get(field.slug)
        if (value !== null && value !== '') {
          result[field.slug] = String(value)
        }
      }
    }
  }

  return result
}
```

### 4.2 フォーム定義は API から取得する

API がフォーム項目（ラベル・必須・選択肢など）を一元管理します。`GET /app/api/contact/forms/public/:slug` で以下のような JSON を取得できます。

```json
{
  "id": "clzv5...",
  "name": "お問い合わせ",
  "slug": "inquiry",
  "description": null,
  "successMessage": "お問い合わせありがとうございました。",
  "replyToFieldSlug": "email",
  "turnstileEnabled": true,
  "fields": [
    {
      "slug": "attribute",
      "label": "あなたの属性を教えてください",
      "type": "RADIO",
      "required": true,
      "order": 1,
      "options": [
        { "value": "general", "label": "一般の方" },
        { "value": "ophthalmologist", "label": "眼科医" }
      ]
    },
    {
      "slug": "message",
      "label": "お問い合わせ",
      "type": "TEXTAREA",
      "required": true,
      "order": 9
    }
  ]
}
```

フロントエンドはこのレスポンスだけでフォームを描画できます。`replyToFieldSlug` に設定された slug を基に、API 側が送信データから返信先メールアドレスを抽出します。コード上に重複した定義を持つ必要はありません。

### 4.3 ページ初期化スクリプト（`src/lib/contact/common/mount.ts` と各 `init.ts`）

Astro ではフォーム slug をマークアップに埋め込み、初期化スクリプトが API から定義を取得して入力→確認→完了の 3 ステップ UI を構築します。

```astro
<!-- src/pages/contact/index.astro（抜粋） -->
<form id="contact-form-input" data-form-slug="inquiry" class="space-y-6">
  <div id="dynamic-fields" class="space-y-6"></div>
  <!-- Turnstile コンテナや送信ボタンをここに配置 -->
</form>

<script src="@lib/contact/inquiry/init.ts"></script>
```

共通処理は `src/lib/contact/common/mount.ts` に集約しています。フォーム slug ごとに API を呼び出し、返却された `fields` で DOM を生成し、Turnstile 初期化・送信処理・完了画面への遷移を一括で行います。

```ts
// src/lib/contact/common/mount.ts（抜粋）
import { fetchContactFormMetadata, submitContactForm } from './api'
import { mountTurnstileWidget } from '@utils/turnstileClient'
import { buildOptionLabelMap } from './definitions'

const bootstrapContactForm = async () => {
  const formInput = document.querySelector<HTMLFormElement>('#contact-form-input')
  if (!formInput) throw new Error('contact-form-input が見つかりません')

  const formSlug = formInput.dataset.formSlug ?? 'inquiry'

  const metadata = await fetchContactFormMetadata(formSlug)
  const definitionFields = metadata.fields ?? []
  if (definitionFields.length === 0) {
    showResponseMessage(responseMessageInput, 'フォーム項目が定義されていません。', 'error')
    return
  }
  const sortedFields = [...definitionFields].sort(
    (a, b) =>
      (a.order ?? Number.MAX_SAFE_INTEGER) - (b.order ?? Number.MAX_SAFE_INTEGER) || a.slug.localeCompare(b.slug)
  )
  const optionLabels = buildOptionLabelMap(sortedFields)
  // フィールド生成、Turnstile 初期化、送信処理をここで実装
}

let isMounted = false

export const mountContactFormPage = () => {
  if (isMounted) return
  isMounted = true
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => void bootstrapContactForm())
  } else {
    void bootstrapContactForm()
  }
}
```

ページごとには薄いエントリのみ用意すれば十分です。

```ts
// src/lib/contact/inquiry/init.ts
import { mountContactFormPage } from '../common/mount'

mountContactFormPage()

// src/lib/contact/recruit/init.ts も同内容
```

### 4.4 Turnstile ローダー (`src/utils/turnstileClient.ts`)

Turnstile の公式スクリプトは 1 度だけ読み込み、複数フォームから再利用できるようユーティリティを用意します。

```ts
// src/utils/turnstileClient.ts（抜粋）
export const TURNSTILE_SCRIPT_URL = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'

let loader: Promise<void> | null = null

const loadTurnstileScript = (): Promise<void> => {
  if (typeof window === 'undefined') {
    return Promise.reject(new Error('Turnstile can only be loaded in the browser.'))
  }
  if (loader) return loader
  loader = new Promise((resolve, reject) => {
    const script = document.createElement('script')
    script.src = TURNSTILE_SCRIPT_URL
    script.async = true
    script.defer = true
    script.dataset.turnstile = 'true'
    script.onload = () => resolve()
    script.onerror = () => reject(new Error('Turnstile script failed to load.'))
    document.head.appendChild(script)
  })
  return loader
}

export const mountTurnstileWidget = async ({ container, siteKey, onToken, onError, onTimeout }: MountTurnstileOptions) => {
  await loadTurnstileScript()
  const instance = (window as TurnstileWindow).turnstile
  if (!instance) throw new Error('Turnstile global object is unavailable after load.')
  // render / reset を実装
}
```

必要に応じて `getToken` や `reset` を公開し、送信後にトークンをクリアしたりタイムアウト時に再描画したりできます。

### 4.5 Svelte コンポーネント例 (`src/components/contact/ContactForm.svelte`)

Svelte を採用している場合は、共通 API を内部で利用するコンポーネントを用意しておくと再利用が容易です。`ContactForm.svelte` では `slug` を受け取り、API から取得した `fields` でフォーム UI をレンダリングします。

```svelte
<script lang="ts">
  import { onMount } from 'svelte'
  import {
    buildSubmissionValues,
    fetchContactFormMetadata,
    submitContactForm,
    type ContactFormMetadata,
  } from '@lib/contact/common/api'
  import { buildOptionLabelMap, type ContactFieldDefinition } from '@lib/contact/common/definitions'
  import { mountTurnstileWidget, type TurnstileController } from '@utils/turnstileClient'

  export let slug: string
  let metadata: ContactFormMetadata | null = null
  let fields: ContactFieldDefinition[] = []
  let optionLabels = {}

  onMount(async () => {
    metadata = await fetchContactFormMetadata(slug)
    fields = metadata.fields ?? []
    optionLabels = buildOptionLabelMap(fields)
  })

  // 以降、metadata 取得後にフォームを描画・送信する処理を実装
</script>
```

Astro ページからは次のように呼び出します。

```astro
---
import ContactForm from '@components/contact/ContactForm.svelte'
---

<ContactForm slug="inquiry" client:load />
```

`slug` を切り替えるだけで採用フォームなども同じコンポーネントで扱えるため、Astro 側では最低限の記述で済みます。

### 4.6 お知らせ・投稿関連の実装 (`src/lib/posts/api.ts`)

お知らせページから Hono API を呼び出すコードは `src/lib/posts/api.ts` に集約します。公開投稿一覧と投稿詳細を取得し、`customFields`（値）と `customFieldSet`（定義）を組み合わせて描画できるよう正規化しています。

```ts
// src/lib/posts/api.ts（抜粋）
import { getApiBaseUrl } from '../utils/api'

export type CustomFieldDefinition = {
  id: string
  type: 'text' | 'richText' | 'date' | 'file' | 'select' | 'checkbox' | 'group' | 'repeatable'
  slug: string
  label: string
  description?: string | null
  config?: Record<string, unknown> | null
  validation?: Record<string, unknown> | null
  children?: CustomFieldDefinition[]
}

export type PublicPost = {
  id: string
  postSettingId: string
  postSettingName: string | null
  postSettingSlug: string | null
  title: string
  categoryId: string | null
  categoryName: string | null
  detailEnabled: boolean
  detailSlug: string | null
  detailBody: string | null
  publishedAt: string | null
  postedAt: string | null
  status: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED'
  customFields: Record<string, unknown> | null
  customFieldSet: {
    id: string
    name: string
    slug: string
    definitions: CustomFieldDefinition[]
  } | null
  createdAt: string
  updatedAt: string
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const parseCustomFields = (raw: unknown): Record<string, unknown> | null => {
  if (!raw) return null
  if (isRecord(raw)) return raw
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw)
      return isRecord(parsed) ? parsed : null
    } catch {
      return null
    }
  }
  return null
}

const normalizePublicPost = (post: ApiPublicPost): PublicPost => ({
  ...post,
  detailSlug:
    typeof post.detailSlug === 'string' && post.detailSlug.trim().length > 0 ? post.detailSlug.trim() : null,
  customFields: parseCustomFields(post.customFields),
})

export const fetchPublicPosts = async (): Promise<PublicPost[]> => {
  const response = await fetch(`${getApiBaseUrl()}/posts/public`, { headers: { Accept: 'application/json' } })
  if (!response.ok) {
    console.error(`投稿一覧の取得に失敗しました (status: ${response.status})`)
    return []
  }
  const posts = (await response.json()) as ApiPublicPost[]
  return posts.map((post) => normalizePublicPost(post))
}

export const fetchPublicPostById = async (id: string): Promise<PublicPost | null> => {
  const response = await fetch(`${getApiBaseUrl()}/posts/public/${encodeURIComponent(id)}`, {
    headers: { Accept: 'application/json' },
  })
  if (!response.ok) {
    console.error(`投稿の取得に失敗しました (status: ${response.status})`)
    return null
  }
  const post = (await response.json()) as ApiPublicPost
  return normalizePublicPost(post)
}
```

### 4.7 お知らせ一覧ページ (`src/pages/posts/index.astro`)

お知らせ一覧ページでは `fetchPublicPosts()` を使用して投稿データを取得し、一覧表示します。`detailEnabled` と `detailSlug` が揃っている投稿は `/posts/[slug]` に遷移させ、それ以外で `detailBody` を持つ投稿はその場でアコーディオン展開します（公開ページから外部 URL・添付ファイルを直接参照するケースは現在廃止）。

```astro
---
import Layout from '@layouts/Layout.astro'
import { fetchPublicPosts, type PublicPost } from '@lib/posts/api'

export const prerender = false

const posts: PublicPost[] = await fetchPublicPosts()

const formatDate = (value: string | null) => {
  if (!value) return '未設定'
  try {
    return new Intl.DateTimeFormat('ja-JP', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date(value))
  } catch {
    return value ?? '未設定'
  }
}

const hasDetailPage = (post: PublicPost) => Boolean(post.detailEnabled && post.detailSlug)
const shouldShowInlineDetail = (post: PublicPost) => !hasDetailPage(post) && Boolean(post.detailBody)
---

<Layout pageTitleJa="お知らせ一覧">
  <section class="space-y-6">
    <header class="space-y-2">
      <h1 class="text-2xl font-semibold">お知らせ一覧</h1>
      <p class="text-sm text-gray-600">管理画面で登録したお知らせをテンプレート単位で表示します。</p>
    </header>

    <ul class="space-y-3">
      {posts.length === 0 ? (
        <li class="rounded-md border border-dashed border-gray-300 bg-white px-4 py-6 text-center text-sm text-gray-500">
          現在表示できる投稿はありません。
        </li>
      ) : (
        posts.map((post) => (
          <li key={post.id} class="rounded-md border border-gray-200 bg-white px-4 py-5 shadow-sm space-y-3">
            <div>
              <h2 class="text-lg font-medium text-gray-900">{post.title}</h2>
              <p class="mt-1 text-xs text-gray-500 flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-4">
                <span>カテゴリ: {post.categoryName ?? '未設定'}</span>
                <span>テンプレート: {post.postSettingName ?? '未設定'}</span>
                <span>公開日: {formatDate(post.publishedAt)}</span>
              </p>
            </div>
            {shouldShowInlineDetail(post) ? (
              <details class="article-details">
                <summary class="article-summary text-sm text-indigo-600 hover:text-indigo-800">
                  クリックして本文を表示
                </summary>
                <div class="prose prose-sm max-w-none text-gray-800" set:html={post.detailBody}></div>
              </details>
            ) : null}
            {hasDetailPage(post) ? (
              <p>
                <a
                  href={`/posts/${encodeURIComponent(post.detailSlug!)}`}
                  class="inline-flex items-center rounded-md border border-indigo-200 px-3 py-2 text-sm font-medium text-indigo-700 transition hover:border-indigo-400 hover:text-indigo-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
                >
                  詳細ページへ
                </a>
              </p>
            ) : null}
          </li>
        ))
      )}
    </ul>
  </section>
</Layout>
```

***

個別投稿の詳細を表示する場合、動的ルートを使用して `fetchPublicPostById()` で詳細を取得します。

```astro
---
import Layout from '@layouts/Layout.astro'
import RenderCustomFields from '@components/RenderCustomFields.astro'
import { fetchPublicPostById } from '@lib/posts/api'

export const prerender = false

const { id } = Astro.params

if (!id) {
  return Astro.redirect('/posts')
}

const post = await fetchPublicPostById(id)

if (!post) {
  return Astro.redirect('/404')
}
---

<Layout pageTitleJa={post.title}>
  <article class="space-y-6">
    <header class="space-y-2">
      <h1 class="text-2xl font-semibold">{post.title}</h1>
      <dl class="flex flex-wrap gap-4 text-xs text-gray-500">
        <div>
          <dt class="font-semibold">カテゴリ</dt>
          <dd>{post.categoryName ?? '未設定'}</dd>
        </div>
        <div>
          <dt class="font-semibold">テンプレート</dt>
          <dd>{post.postSettingName ?? '未設定'}</dd>
        </div>
        <div>
          <dt class="font-semibold">公開日</dt>
          <dd>{new Date(post.publishedAt ?? post.createdAt).toLocaleDateString('ja-JP')}</dd>
        </div>
      </dl>
    </header>

    {post.detailBody ? (
      <div class="prose max-w-none" set:html={post.detailBody}></div>
    ) : (
      <p class="text-gray-500">本文は登録されていません。</p>
    )}

    {post.customFieldSet && post.customFieldSet.definitions.length && post.customFields ? (
      <RenderCustomFields fieldSet={post.customFieldSet} fields={post.customFields} />
    ) : null}
  </article>
</Layout>
```

この例では API から返却される `customFieldSet.definitions` を `RenderCustomFields` コンポーネントに渡し、フィールド種別ごとの描画ロジック（select のラベル解決や繰り返しグループの入れ子構造など）を共通化しています。外部プロジェクトで独自に表示する場合も、同様に定義ツリーを巡回して値を解釈してください。

***

## 7. テストと検証の推奨事項

1. ローカル（`docker compose up`）で Astro アプリを `bunx astro dev` で起動し、`http://localhost:4321` からフォーム送信を検証する。
2. Turnstile を有効にした状態で、トークン期限切れ・キャンセルなど異常系も確認する。
3. API 側では `bun test` を実行し、問い合わせ関連のユニットテストが通っていることを確認する。
4. Admin でフォーム名や成功メッセージなどのメタ情報を変更したあと、Astro フロントで再読み込みすれば反映されるかを確認する（項目定義は Astro プロジェクト側で更新）。
5. 本番デプロイ前に `bun run build` を実行し、その後ホスト側の `apps/api` ディレクトリで `bunx wrangler deploy --dry-run` を行い、Cloudflare Workers での挙動を事前確認する。

***

## 8. 追加のブラウザ側セキュリティ

- **Subresource Integrity (SRI)**
  - 自前ホストまたは固定ハッシュのライブラリを読み込む場合は `integrity` と `crossorigin` を付与してください。
  - Turnstile v0 API は公式でハッシュが提供されていないため、CSP と HTTPS で保護します。ただし、必要に応じてハッシュを生成して SRI を適用可能です（例: `<script src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit" integrity="sha384-..." crossorigin="anonymous" async defer></script>`）。
- **クライアントバリデーション**
  - HTML 属性（`required`, `type="email"`, `pattern`, `minlength` 等）に加え、JavaScript での形式チェックも行うと UX が向上します。
  - ただしサーバー側の Zod 検証が最終的な安全網になるため、クライアントバリデーションのみには依存しないでください。
- **安全なエラー表示**
  - レスポンスメッセージは `textContent` で表示し、ユーザー入力を HTML に埋め込む場合は DOMPurify などでサニタイズします。
- **Turnstile の再認証**
  - トークンは 2 分程度で失効するため、送信成功・失敗時にも `reset()` を呼び出して新しいトークンを取得してください。

***

## 9. まとめ

- 外部 Astro プロジェクトはフォーム項目をローカルで管理しつつ、`formSlug` / `values` / `turnstileToken` を揃えて Hono API へ送信します。API から取得するメタ情報（成功メッセージ等）は必要に応じて反映します。
- CORS (`ALLOWED_ORIGINS`) と CSP を適切に設定することで、既存のセキュリティレイヤーを崩さずに外部サイトから連携可能です。
- Admin 側の変更に追従できる実装パターンを採用し、本番公開前に必ずフォームフロー全体を検証してください。

### 外部サービス連携

- **Resend**: メール配信（通知・パスワードリセット等）
- **Cloudflare Turnstile**: フォームのスパム対策
- **Google Analytics**: アクセス解析

## カスタムフィールド機能

本システムでは、標準の投稿項目（タイトル、本文など）に加えて、任意の情報を追加できるカスタムフィールド機能を提供します。

### 1. カスタムフィールドセットの管理

- **場所**: `設定 > カスタムフィールド`
- **機能**: 投稿に追加するフィールド群を「セット」として管理します。
- **操作**:
  - **作成**: 新しいセットを名称とスラッグ（半角英数字とハイフン）を指定して作成します。
  - **編集**: 既存のセットの名称や説明を更新します。
  - **削除**: 不要になったセットを削除します。セットを削除すると、それに紐づく全てのフィールド定義も削除されます。

### 2. フィールド定義の管理

- **場所**: `設定 > カスタムフィールド`内の各セット詳細
- **機能**: セットに含める個別のフィールド（テキスト、リッチテキスト、日付、ファイルなど）を定義します。
- **操作**:
  - **追加**: フィールドのラベル、スラッグ、種別（テキスト、リッチテキスト、日付、ファイル、選択肢、チェックボックス、グループ、繰り返し）を指定して新しいフィールドを追加します。
  - **編集**: 既存のフィールド定義を更新します。
  - **削除**: 不要になったフィールド定義を削除します。
  - **ネスト**: 「親フィールド」を選択することで、グループや繰り返しフィールドの中にフィールドをネストさせることができます。

### 3. 投稿での利用

- **場所**: `投稿管理 > 新規作成` または `各投稿の編集画面`
- **操作**:
  1. 「カスタムフィールドセット」のドロップダウンから、その投稿に適用したいセットを選択します。
  2. セットを選択すると、定義されたフィールドの入力フォームが動的に表示されます。
  3. 各フィールドに情報を入力し、投稿を保存します。

入力されたカスタムフィールドの値は、公開側の投稿詳細ページで自動的に描画されます。
