<!--
  @component
  This component handles file uploads for custom fields.
  It includes a file input, upload progress, and displays the current file.
-->
<svelte:options runes={false} />
<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import type { FileValue } from './types';

  export let value: FileValue = null;
  export let label: string;
  export let description: string | undefined;

  const dispatch = createEventDispatcher<{ change: FileValue }>();

  let fileInput: HTMLInputElement | null = null;
  let currentValue: FileValue = value;
  let lastReceivedValue: FileValue = value;
  let isUploading = false;
  let uploadError: string | null = null;
  let uploadProgress: number | null = null;

  $: if (value !== lastReceivedValue) {
    lastReceivedValue = value;
    currentValue = value;
  }

  const handleFileChange = async () => {
    const file = fileInput?.files?.[0];
    if (!file) {
      return;
    }

    isUploading = true;
    uploadError = null;
    uploadProgress = 0;

    try {
      await new Promise((resolve) => setTimeout(resolve, 1500));
      const nextValue: FileValue = {
        key: `uploads/temp/${file.name}`,
        url: URL.createObjectURL(file),
        fileName: file.name,
        contentType: file.type,
        fileSize: file.size,
      };

      currentValue = nextValue;
      dispatch('change', nextValue);
    } catch (error) {
      uploadError = error instanceof Error ? error.message : 'Upload failed';
    } finally {
      isUploading = false;
      uploadProgress = null;
    }
  };

  const removeFile = () => {
    currentValue = null;
    dispatch('change', null);
  };
</script>

<div class="file-input-wrapper">
  <span class="label">{label}</span>
  {#if description}
    <p class="description">{description}</p>
  {/if}

  {#if currentValue && currentValue.url}
    <div class="preview">
      <p>現在ファイル:</p>
      <a href={currentValue.url} target="_blank" rel="noopener noreferrer">
        {currentValue.fileName ?? 'ファイルを表示'}
      </a>
      <button type="button" on:click={removeFile} class="remove-button">削除</button>
    </div>
  {:else}
    <input type="file" bind:this={fileInput} on:change={handleFileChange} disabled={isUploading} />
    {#if isUploading}
      <div>アップロード中... {uploadProgress !== null ? `${uploadProgress}%` : ''}</div>
    {/if}
    {#if uploadError}
      <p class="error">{uploadError}</p>
    {/if}
  {/if}
</div>

<style>
  .file-input-wrapper {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }
  .label {
    font-weight: 600;
  }
  .description {
    font-size: 0.85rem;
    color: #6b7280;
  }
  .preview {
    display: flex;
    align-items: center;
    gap: 1rem;
  }
  .remove-button {
    font-size: 0.8rem;
    color: #dc2626;
    cursor: pointer;
    border: none;
    background: none;
  }
  .error {
    font-size: 0.8rem;
    color: #dc2626;
  }
</style>
