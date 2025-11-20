<script lang="ts">
  type SelectOption = { label: string; value: string };
  type SelectConfig = { options?: SelectOption[] };

  export let config: SelectConfig = {};

  const ensureOptions = () => {
    if (!Array.isArray(config.options)) {
      config = { ...config, options: [] };
    }
  };

  ensureOptions();

  const addOption = () => {
    ensureOptions();
    const options = config.options ?? [];
    config = { ...config, options: [...options, { label: '', value: '' }] };
  };

  const removeOption = (index: number) => {
    ensureOptions();
    const options = config.options ?? [];
    config = { ...config, options: options.filter((_, i) => i !== index) };
  };

  const updateOption = (index: number, key: keyof SelectOption, value: string) => {
    ensureOptions();
    const options = config.options ?? [];
    config = {
      ...config,
      options: options.map((option, i) => (i === index ? { ...option, [key]: value } : option)),
    };
  };
</script>

<div class="space-y-3 rounded-md border border-gray-200 p-4">
  <h4 class="font-medium text-gray-800">選択肢設定</h4>

  <div class="space-y-2">
    {#key config}
      {#if config.options && config.options.length > 0}
        {#each config.options as option, i (i)}
          <div class="grid grid-cols-12 items-center gap-2">
            <div class="col-span-5">
              <label for={`option-label-${i}`} class="sr-only">ラベル</label>
              <input
                id={`option-label-${i}`}
                type="text"
                placeholder="ラベル"
                class="input"
                value={option.label}
                oninput={(event) => updateOption(i, 'label', event.currentTarget.value)}
              />
            </div>
            <div class="col-span-5">
              <label for={`option-value-${i}`} class="sr-only">値</label>
              <input
                id={`option-value-${i}`}
                type="text"
                placeholder="値"
                class="input"
                value={option.value}
                oninput={(event) => updateOption(i, 'value', event.currentTarget.value)}
              />
            </div>
            <div class="col-span-2">
              <button type="button" onclick={() => removeOption(i)} class="text-red-500 hover:text-red-700 p-2">
                削除
              </button>
            </div>
          </div>
        {/each}
      {/if}
    {/key}
  </div>

  <button type="button" onclick={addOption} class="btn-secondary text-sm">選択肢を追加</button>
</div>

<style>
  @reference '@repo/tailwind-config/tailwind.css';

  .input {
    @apply w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm;
  }
  .btn-secondary {
    @apply inline-flex items-center rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50;
  }
</style>
