<script lang="ts">
  export let config: { toolbarPreset?: 'basic' | 'standard' | 'full' } | null | undefined = {};

  const ensureConfig = () => {
    if (!config || typeof config !== 'object') {
      config = { toolbarPreset: 'full' };
      return;
    }
    if (!config.toolbarPreset) {
      config = { ...config, toolbarPreset: 'full' };
    }
  };

  ensureConfig();

  const updatePreset = (value: string) => {
    ensureConfig();
    if (value === 'basic' || value === 'standard' || value === 'full') {
      config = { ...config, toolbarPreset: value };
    }
  };

  const presetValue = () => config?.toolbarPreset ?? 'full';

  $: ensureConfig();
</script>

<div class="space-y-2 rounded-md border border-gray-200 p-4">
  <h4 class="font-medium text-gray-800">リッチテキスト設定</h4>
  <div>
    <label for="toolbarPreset" class="label">ツールバープリセット</label>
    <select
      id="toolbarPreset"
      class="input"
      value={presetValue()}
      oninput={(event) => updatePreset((event.currentTarget as HTMLSelectElement).value)}
    >
      <option value="basic">Basic（太字・斜体・下線・リンク・文字色）</option>
      <option value="standard">Standard（Basic + 箇条書き・番号付き・見出し H2/H3）</option>
      <option value="full">Full（Standard + 引用・コードブロック・罫線・改行）</option>
    </select>
  </div>
</div>

<style>
  @reference '@repo/tailwind-config/tailwind.css';

  .label {
    @apply block text-sm font-medium text-gray-700 mb-1;
  }
  .input {
    @apply w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm;
  }
</style>
