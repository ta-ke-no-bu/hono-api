<script lang="ts">
  export let config: { multiline?: boolean } | null | undefined = {};

  const ensureConfig = () => {
    if (!config || typeof config !== 'object') {
      config = {};
    }
  };

  ensureConfig();

  const toggleMultiline = (checked: boolean) => {
    ensureConfig();
    config = { ...config, multiline: checked };
  };

  const multilineChecked = () => Boolean(config?.multiline);

  $: ensureConfig();
</script>

<div class="space-y-2 rounded-md border border-gray-200 p-4">
  <h4 class="font-medium text-gray-800">テキスト設定</h4>
  <div class="flex items-center">
    <input
      id="multiline"
      type="checkbox"
      class="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
      checked={multilineChecked()}
      oninput={(event) => toggleMultiline((event.currentTarget as HTMLInputElement).checked)}
    />
    <label for="multiline" class="ml-2 block text-sm text-gray-900">複数行の入力を許可する</label>
  </div>
</div>
