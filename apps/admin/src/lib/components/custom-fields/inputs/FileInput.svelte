<script lang="ts">
  import { PUBLIC_API_BASE_URL } from '$env/static/public';
  import { createEventDispatcher, getContext, onMount } from 'svelte';
  import type { CustomFieldDefinition } from '../../../custom-fields/types';

  type FileValue = {
    key: string;
    url: string;
    fileName?: string;
    fileType?: string;
    fileSize?: number;
    alt?: string;
  } | null;

  type FileFieldConfig = {
    accept?: string;
    maxSize?: number;
  };

  type FileFieldDefinition = CustomFieldDefinition & {
    config?: FileFieldConfig | null;
  };

  type Props = {
    definition: FileFieldDefinition;
    value?: FileValue | null;
  };

  const { definition, value: initialValue = null } = $props<Props>();

  let value = $state<FileValue | null>(initialValue);
  let fileInput = $state<HTMLInputElement | null>(null);
  let uploading = $state(false);
  let uploadError = $state<string | null>(null);

  const dispatch = createEventDispatcher<{ change: FileValue }>();

  const fieldConfig = $derived(() => (definition.config as FileFieldConfig | null | undefined) ?? null);

  const token = getContext<string>('sessionToken'); // Assuming session token is provided via context

  const normalizeBaseUrl = (raw: string) => raw.replace(/\/$/, '');

  const resolveApiBaseUrl = () => {
    if (PUBLIC_API_BASE_URL && PUBLIC_API_BASE_URL.length > 0) {
      try {
        const parsed = new URL(PUBLIC_API_BASE_URL);
        if (typeof window !== 'undefined') {
          const currentProtocol = window.location.protocol;
          const currentHost = window.location.hostname;
          const needsRewrite = parsed.hostname.includes('hono_api');
          const protocol = needsRewrite ? currentProtocol : parsed.protocol;
          const hostname = needsRewrite ? currentHost : parsed.hostname;
          const port = parsed.port ? `:${parsed.port}` : '';
          const pathname = parsed.pathname && parsed.pathname !== '/' ? parsed.pathname.replace(/\/$/, '') : '';
          return normalizeBaseUrl(`${protocol}//${hostname}${port}${pathname}`);
        }
        const fallbackPort = parsed.port ? `:${parsed.port}` : '';
        const fallbackPath = parsed.pathname && parsed.pathname !== '/' ? parsed.pathname.replace(/\/$/, '') : '';
        return normalizeBaseUrl(`${parsed.protocol}//${parsed.hostname}${fallbackPort}${fallbackPath}`);
      } catch (error) {
        console.warn('[file-input] failed to parse PUBLIC_API_BASE_URL', error);
      }
    }
    if (typeof window !== 'undefined') {
      return normalizeBaseUrl(window.location.origin);
    }
    return '';
  };

  let apiBaseUrl = $state(resolveApiBaseUrl());

  onMount(() => {
    apiBaseUrl = resolveApiBaseUrl();
  });

  async function handleFileChange() {
    const file = fileInput?.files?.[0];
    if (!file) {
      return;
    }

    uploading = true;
    uploadError = null;

    try {
      // ファイルタイプとサイズをバリデーション
      const accept = fieldConfig?.accept;
      const maxSize = fieldConfig?.maxSize; // MB
      if (accept) {
        const acceptedTypes = accept
          .split(',')
          .map((type) => type.trim())
          .filter((type) => type.length > 0);
        const fileType = file.type;
        const fileName = file.name;
        const isAccepted = acceptedTypes.some((acceptedType) => {
          if (acceptedType.startsWith('.')) {
            return fileName.toLowerCase().endsWith(acceptedType.toLowerCase());
          }
          if (acceptedType.endsWith('/*')) {
            return fileType.startsWith(acceptedType.slice(0, -1));
          }
          return fileType === acceptedType;
        });

        if (!isAccepted) {
          throw new Error(`許可されていないファイルタイプです: ${fileType}`);
        }
      }

      if (maxSize && file.size > maxSize * 1024 * 1024) {
        throw new Error(`ファイルサイズが大きすぎます。最大 ${maxSize}MB`);
      }
      // 署名付きURLの取得
      const uploadPath = (() => {
        if (file.type === 'application/pdf') {
          return 'pdf';
        }
        if (file.type.startsWith('image/')) {
          return 'image';
        }
        throw new Error(`対応していないファイルタイプです: ${file.type}`);
      })();

      const presignResponse = await fetch(`${apiBaseUrl}/app/api/uploads/${uploadPath}`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          fileName: file.name,
          contentType: file.type,
          contentLength: file.size,
          purpose: 'post-custom-field', // 用途を明記
        }),
      });

      if (!presignResponse.ok) {
        const errorData = await presignResponse.json();
        throw new Error(errorData.message || '署名付きURLの発行に失敗しました。');
      }

      const presigned: { uploadUrl: string; objectUrl: string; key: string } = await presignResponse.json();

      // ファイルのアップロード
      const uploadResponse = await fetch(presigned.uploadUrl, {
        method: 'PUT',
        headers: {
          'Content-Type': file.type,
          'Content-Length': file.size.toString(),
        },
        body: file,
      });

      if (!uploadResponse.ok) {
        throw new Error('ファイルのアップロードに失敗しました。');
      }

      value = {
        key: presigned.key,
        url: presigned.objectUrl,
        fileName: file.name,
        fileType: file.type,
        fileSize: file.size,
      };
      dispatch('change', value);
    } catch (error: unknown) {
      uploadError = error instanceof Error ? error.message : 'Upload failed';
      value = null; // エラー時は値をクリア
      dispatch('change', value);
    } finally {
      uploading = false;
      if (fileInput) {
        fileInput.value = '';
      }
    }
  }

  function removeFile() {
    value = null;
    dispatch('change', value);
    if (fileInput) {
      fileInput.value = '';
    }
  }

  // ファイルのプレビュー表示 (画像の場合)
  const isImage = $derived(() => Boolean(value?.fileType?.startsWith('image/')));
</script>

<div class="form-field">
  <label for={definition.slug} class="label">{definition.label}</label>

  {#if value}
    <div class="flex items-center space-x-2">
      {#if isImage}
        <img src={value.url} alt={value.fileName} class="w-24 h-24 object-cover rounded-md" />
      {/if}
      <p class="text-sm text-gray-700">{value.fileName} ({Math.round(value.fileSize / 1024)} KB)</p>
      <button type="button" onclick={removeFile} class="text-red-500 hover:text-red-700 text-sm">削除</button>
    </div>
  {:else}
    <input
      id={definition.slug}
      name={definition.slug}
      type="file"
      class="input"
      bind:this={fileInput}
      onchange={handleFileChange}
      accept={fieldConfig?.accept}
      disabled={uploading}
    />
    {#if uploading}
      <p class="text-sm text-indigo-600 mt-1">アップロード中...</p>
    {/if}
    {#if uploadError}
      <p class="text-sm text-red-500 mt-1">エラー: {uploadError}</p>
    {/if}
  {/if}

  {#if definition.description}
    <p class="help-text">{definition.description}</p>
  {/if}
</div>

<style>
  @reference '@repo/tailwind-config/tailwind.css';

  .form-field {
    margin-bottom: calc(var(--spacing) * 2);
  }
  .label {
    @apply block text-sm font-medium text-gray-700;
  }
  .input {
    @apply mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500;
  }
  .help-text {
    @apply mt-1 text-xs text-gray-500;
  }
</style>
