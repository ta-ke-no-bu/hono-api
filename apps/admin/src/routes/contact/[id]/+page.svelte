<svelte:options runes={false} />
<script lang="ts">
  import type { ContactFieldDefinition } from '@lib/contactFormDefinitions';
  import { CONTACT_FORM_DEFINITIONS, resolveOptionLabel } from '@lib/contactFormDefinitions';
  import type { PageData } from './$types';

  export let data: PageData;

  type DisplayField = {
    label: string;
    value: string;
    order: number;
  };

  type SummaryRow = {
    label: string;
    value: string;
  };

  function sanitizeString(value: unknown, fallback = 'N/A'): string {
    if (typeof value === 'string' && value.trim().length > 0) {
      return value;
    }
    return fallback;
  }

  function formatDate(dateString: string | null | undefined): string {
    if (!dateString) return 'N/A';
    const options: Intl.DateTimeFormatOptions = {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    };
    return new Date(dateString).toLocaleString('ja-JP', options);
  }

  function buildSummaryRows(contact: PageData['contact'] | null | undefined): SummaryRow[] {
    if (!contact) {
      return [];
    }

    return [
      { label: 'ID', value: sanitizeString(contact.id) },
      { label: 'フォーム', value: sanitizeString(contact.formName) },
      { label: 'メールアドレス', value: sanitizeString(contact.displayEmail) },
      { label: '名前', value: sanitizeString(contact.displayName) },
      { label: 'ステータス', value: sanitizeString(contact.emailStatus) },
      { label: '受信日時', value: formatDate(contact.createdAt) },
    ];
  }

  function buildDisplayFields(contact: PageData['contact'] | null | undefined): DisplayField[] {
    if (!contact || !contact.payload || typeof contact.payload !== 'object') {
      return [];
    }

    const contactBody = contact.payload as Record<string, unknown>;
    const formDef = CONTACT_FORM_DEFINITIONS[contact.formSlug];

    const sourceFields: ContactFieldDefinition[] = formDef?.fields ?? Object.keys(contactBody).map((slug, index) => ({
      slug,
      label: slug,
      type: 'TEXT',
      order: index,
    }));

    return sourceFields
      .filter((field) => Object.prototype.hasOwnProperty.call(contactBody, field.slug) && field.slug !== 'email_confirm')
      .map((field) => {
        const rawValue = contactBody[field.slug];
        let displayValue = '';

        if (Array.isArray(rawValue)) {
          const normalizedValues = rawValue
            .map((value) => (typeof value === 'string' ? value : String(value ?? '')))
            .filter((value) => value.length > 0);
          displayValue = normalizedValues
            .map((value) => resolveOptionLabel(contact.formSlug, field.slug, value) ?? value)
            .join(', ');
        } else if (typeof rawValue === 'string') {
          displayValue = resolveOptionLabel(contact.formSlug, field.slug, rawValue) ?? rawValue;
        } else if (rawValue != null) {
          displayValue = String(rawValue);
        }

        return {
          label: field.label,
          value: displayValue,
          order: field.order ?? Number.POSITIVE_INFINITY,
        };
      })
      .sort((a, b) => a.order - b.order);
  }

  let summaryRows: SummaryRow[] = [];
  let summaryRowCount = 0;
  let displayFields: DisplayField[] = [];

  $: summaryRows = buildSummaryRows(data.contact);
  $: summaryRowCount = summaryRows.length;
  $: displayFields = buildDisplayFields(data.contact);
</script>

<div class="p-8">
  <div class="flex flex-col gap-4 md:flex-row md:items-center md:justify-between mb-6">
    <h1 class="text-3xl font-bold">問い合わせ詳細</h1>
    <a
      href="/contact"
      class="inline-flex items-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
    >
      一覧に戻る
    </a>
  </div>

  {#if data.contact}
    <div class="bg-white shadow overflow-hidden sm:rounded-lg">
      <div class="px-4 py-5 sm:px-6">
        <h3 class="text-lg leading-6 font-medium text-gray-900">受信内容</h3>
        <p class="mt-1 max-w-2xl text-sm text-gray-500">
          {data.contact.formName}
        </p>
      </div>
      <div class="border-t border-gray-200">
        <dl>
          {#each summaryRows as row, index}
            <div class={`px-4 py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6 ${index % 2 === 0 ? 'bg-gray-50' : 'bg-white'}`}>
              <dt class="text-sm font-medium text-gray-500">{row.label}</dt>
              <dd class="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2 break-words">{row.value}</dd>
            </div>
          {/each}

          {#each displayFields as field, i}
            <div class={`px-4 py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6 ${((summaryRowCount + i) % 2 === 0) ? 'bg-gray-50' : 'bg-white'}`}>
              <dt class="text-sm font-medium text-gray-500">{field.label}</dt>
              <dd class="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2 whitespace-pre-wrap">{field.value}</dd>
            </div>
          {/each}
        </dl>
      </div>
    </div>
  {:else}
    <p class="text-center text-gray-500">問い合わせデータが見つかりませんでした。</p>
  {/if}
</div>
