<script lang="ts" context="module">
export type ContactStep = 'input' | 'confirm' | 'complete'
</script>

<script lang="ts">
import { type TurnstileController, mountTurnstileWidget } from '@utils/turnstileClient';
import {
  type ContactFormMetadata,
  buildSubmissionValues,
  fetchContactFormMetadata,
  submitContactForm,
} from '@lib/contact/common/api';
import {
  type ContactFieldDefinition,
  type ContactOptionLabelMap,
  buildOptionLabelMap,
} from '@lib/contact/common/definitions';
import { onMount, tick } from 'svelte';

type Props = {
  slug: string
}

let { slug } = $props<Props>()

let step: ContactStep = 'input'
let values: Record<string, unknown> = {}
let metadata: ContactFormMetadata | null = null
let fields: ContactFieldDefinition[] = []
let sortedFields: ContactFieldDefinition[] = []
let optionLabels: ContactOptionLabelMap = {}
let error: string | null = null
let successMessage: string | null = null
let loading = false
let turnstileEnabled = true

// biome-ignore lint/style/useConst: Svelteのbind:thisでランタイム代入される
let formElement: HTMLFormElement | null = null
// biome-ignore lint/style/useConst: Svelteのbind:thisでランタイム代入される
let turnstileContainer: HTMLDivElement | null = null
let turnstileToken = ''
let turnstileController: TurnstileController | null = null

const siteKey = import.meta.env.PUBLIC_TURNSTILE_SITE_KEY

const sortFields = (inputFields: ContactFieldDefinition[]) => {
  return [...inputFields].sort((a, b) => {
    const orderA = (a as { order?: number }).order ?? Number.MAX_SAFE_INTEGER
    const orderB = (b as { order?: number }).order ?? Number.MAX_SAFE_INTEGER
    if (orderA !== orderB) return orderA - orderB
    return a.slug.localeCompare(b.slug)
  })
}

onMount(async () => {
  try {
    metadata = await fetchContactFormMetadata(slug)
    fields = metadata.fields ?? []
    sortedFields = sortFields(fields)
    optionLabels = buildOptionLabelMap(fields)
    successMessage = metadata.successMessage ?? null
    turnstileEnabled = metadata.turnstileEnabled ?? true
  } catch (err) {
    error = err instanceof Error ? err.message : 'フォーム情報の取得に失敗しました'
    return
  }

  if (!turnstileEnabled) {
    return
  }

  /** DOM の再描画を待って Turnstile コンテナの bind を保証する */
  await tick()

  if (!turnstileContainer) {
    error = 'Turnstile のコンテナが見つかりません'
    return
  }

  if (!siteKey) {
    error = 'Turnstile のサイトキーが設定されていません'
    return
  }

  try {
    turnstileController = await mountTurnstileWidget({
      container: turnstileContainer,
      siteKey,
      onToken: (token) => {
        turnstileToken = token
      },
      onError: () => {
        turnstileToken = ''
        error = 'Turnstile 検証に失敗しました。再度お試しください。'
      },
      onTimeout: () => {
        turnstileToken = ''
      },
    })
  } catch (err) {
    error = err instanceof Error ? err.message : 'Turnstile の初期化に失敗しました'
  }
})

const resetTurnstile = () => {
  turnstileToken = ''
  turnstileController?.reset()
}

const handlePreview = (event: Event) => {
  event.preventDefault()
  error = null

  if (!formElement) return

  const currentValues = buildSubmissionValues(sortedFields, new FormData(formElement))

  for (const field of sortedFields) {
    if ((field.required ?? false) && !currentValues[field.slug]) {
      error = `${field.label} は必須です。`
      return
    }
  }

  values = currentValues
  step = 'confirm'
}

const handleSubmit = async () => {
  if (turnstileEnabled && !turnstileToken) {
    error = 'セキュリティ検証に失敗しました。再度お試しください。'
    resetTurnstile()
    step = 'input'
    return
  }

  loading = true
  error = null

  try {
    const result = await submitContactForm({
      formSlug: metadata?.slug ?? slug,
      values,
      turnstileToken,
    })
    successMessage =
      result.successMessage ||
      metadata?.successMessage ||
      successMessage ||
      'お問い合わせありがとうございました。'
    step = 'complete'
    if (formElement) {
      formElement.reset()
    }
    if (turnstileEnabled) {
      resetTurnstile()
    }
  } catch (err) {
    error = err instanceof Error ? err.message : '送信に失敗しました。時間をおいて再度お試しください。'
    step = 'input'
    if (turnstileEnabled) {
      resetTurnstile()
    }
  } finally {
    loading = false
  }
}

const backToInput = () => {
  error = null
  step = 'input'
}

const resolveOptionValue = (field: ContactFieldDefinition, raw: unknown) => {
  const labelMap = optionLabels[field.slug]
  if (!labelMap) {
    return raw
  }

  if (typeof raw !== 'string') {
    return raw
  }

  return labelMap[raw] ?? raw
}

const renderValue = (field: ContactFieldDefinition) => {
  const value = values[field.slug]

  if (Array.isArray(value)) {
    if (value.length === 0) {
      return '未入力'
    }

    const labels = value
      .map((item) => {
        if (typeof item === 'string') {
          return resolveOptionValue(field, item)
        }
        return item
      })
      .filter((item) => item !== undefined && item !== null && item !== '')

    return labels.length > 0 ? labels.map(String).join(', ') : '未入力'
  }

  if (value === undefined || value === null || value === '') {
    return '未入力'
  }

  const resolved = resolveOptionValue(field, value)
  return resolved !== undefined && resolved !== null && resolved !== '' ? String(resolved) : '未入力'
}
</script>

{#if step === 'confirm'}
  <section class="space-y-4">
    <h2 class="text-lg font-medium">入力内容の確認</h2>
    <dl class="space-y-3">
      {#each sortedFields as field}
        <div>
          <dt class="text-sm font-semibold text-gray-700">{field.label}</dt>
          <dd class="text-sm text-gray-600">{renderValue(field)}</dd>
        </div>
      {/each}
    </dl>
    <div class="flex gap-4">
      <button
        type="button"
        class="inline-flex flex-1 items-center justify-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm transition-colors hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
        on:click={backToInput}
      >
        戻る
      </button>
      <button
        type="button"
        class="inline-flex flex-1 items-center justify-center rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
        disabled={loading}
        on:click={handleSubmit}
      >
        {loading ? '送信中...' : '送信する'}
      </button>
    </div>
    {#if error}<p class="text-sm text-red-500">{error}</p>{/if}
  </section>
{:else if step === 'complete'}
  <section class="space-y-2">
    <h2 class="text-lg font-medium">送信完了</h2>
    <p class="text-sm text-gray-700">{successMessage ?? 'お問い合わせを受け付けました。'}</p>
  </section>
{:else if sortedFields.length === 0}
  <section class="space-y-2">
    <p class="text-sm text-gray-600">フォームを読み込んでいます...</p>
    {#if error}<p class="text-sm text-red-500">{error}</p>{/if}
  </section>
{:else}
  <form
    class="space-y-6"
    bind:this={formElement}
    on:submit={handlePreview}
  >
    {#each sortedFields as field}
      <div class="space-y-2">
        <label class="block text-sm font-medium text-gray-700" for={`contact-form-${field.slug}`}>
          {field.label}{field.required ?? false ? ' *' : ''}
        </label>

        {#if field.helpText}
          <p class="text-xs text-gray-500">{field.helpText}</p>
        {/if}

        {#if field.type === 'TEXTAREA'}
          <textarea
            id={`contact-form-${field.slug}`}
            name={field.slug}
            rows={4}
            class="w-full resize-y rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500"
            placeholder={field.placeholder}
            required={field.required ?? false}
          ></textarea>
        {:else if field.type === 'SELECT'}
          <select
            id={`contact-form-${field.slug}`}
            name={field.slug}
            class="w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500"
            required={field.required ?? false}
          >
            <option value="">{field.required ?? false ? '選択してください' : '未選択'}</option>
            {#each field.options ?? [] as option}
              <option value={option.value}>{option.label}</option>
            {/each}
            {#if !(field.options && field.options.length)}
              <option value="" disabled>選択肢が設定されていません</option>
            {/if}
          </select>
        {:else if field.type === 'RADIO'}
          <div class="space-y-2">
            {#if field.options && field.options.length}
              {#each field.options as option, index}
                <label class="flex items-center gap-2 text-sm text-gray-700">
                  <input
                    type="radio"
                    name={field.slug}
                    value={option.value}
                    id={`contact-form-${field.slug}-${index}`}
                    required={index === 0 ? field.required ?? false : false}
                  />
                  <span>{option.label}</span>
                </label>
              {/each}
            {:else}
              <p class="text-xs text-red-500">選択肢が設定されていません</p>
            {/if}
          </div>
        {:else if field.type === 'CHECKBOX'}
          <div class="space-y-2">
            {#if field.options && field.options.length}
              {#each field.options as option, index}
                <label class="flex items-center gap-2 text-sm text-gray-700">
                  <input
                    type="checkbox"
                    name={field.slug}
                    value={option.value}
                    id={`contact-form-${field.slug}-${index}`}
                  />
                  <span>{option.label}</span>
                </label>
              {/each}
            {:else}
              <p class="text-xs text-red-500">選択肢が設定されていません</p>
            {/if}
          </div>
        {:else}
          <input
            id={`contact-form-${field.slug}`}
            name={field.slug}
            class="w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500"
            type={field.type === 'EMAIL' ? 'email' : field.type === 'TEL' ? 'tel' : field.type === 'DATE' ? 'date' : field.type === 'NUMBER' ? 'number' : 'text'}
            placeholder={field.placeholder}
            required={field.required ?? false}
          />
        {/if}
      </div>
    {/each}

    {#if turnstileEnabled}
      <div class="flex justify-center">
        <div bind:this={turnstileContainer}></div>
        <input type="hidden" name="turnstileToken" id="turnstile-token" value={turnstileToken} />
      </div>
    {/if}

    <button
      type="submit"
      class="inline-flex w-full items-center justify-center rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
      disabled={loading || sortedFields.length === 0}
    >
      {loading ? '送信中...' : '確認画面へ'}
    </button>
    {#if error}<p class="text-sm text-red-500">{error}</p>{/if}
  </form>
{/if}
