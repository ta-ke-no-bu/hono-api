<script lang="ts">
  export let config: { accept?: string[] } | null | undefined = {};

  const indeterminate = (node: HTMLInputElement, value: boolean) => {
    node.indeterminate = value;
    return {
      update(next: boolean) {
        node.indeterminate = next;
      },
    };
  };

  const PRESET_GROUPS: { label: string; options: { label: string; value: string }[] }[] = [
    {
      label: '画像',
      options: [
        { label: '.jpeg', value: '.jpeg' },
        { label: '.jpg', value: '.jpg' },
        { label: '.png', value: '.png' },
        { label: '.svg', value: '.svg' },
        { label: '.gif', value: '.gif' },
        { label: '.webp', value: '.webp' },
      ],
    },
    {
      label: '書類',
      options: [
        { label: '.txt', value: '.txt' },
        { label: '.csv', value: '.csv' },
        { label: '.pdf', value: '.pdf' },
        { label: '.json', value: '.json' },
        { label: '.doc', value: '.doc' },
        { label: '.docx', value: '.docx' },
        { label: '.ppt', value: '.ppt' },
        { label: '.pptx', value: '.pptx' },
        { label: '.xls', value: '.xls' },
        { label: '.xlsx', value: '.xlsx' },
      ],
    },
    {
      label: '音声',
      options: [
        { label: '.aac', value: '.aac' },
        { label: '.midi', value: '.midi' },
        { label: '.mid', value: '.mid' },
        { label: '.mp3', value: '.mp3' },
        { label: '.wav', value: '.wav' },
      ],
    },
    {
      label: '動画',
      options: [
        { label: '.mp4', value: '.mp4' },
        { label: '.mpeg', value: '.mpeg' },
        { label: '.webm', value: '.webm' },
      ],
    },
    {
      label: 'その他',
      options: [
        { label: '.zip', value: '.zip' },
        { label: '.gz', value: '.gz' },
        { label: '.ttf', value: '.ttf' },
        { label: '.woff', value: '.woff' },
        { label: '.epub', value: '.epub' },
      ],
    },
  ];

  const normalizeValues = (values: string[]) =>
    Array.from(new Set(values.map((value) => value.trim()).filter((value) => value.length > 0)));

  const ensureConfig = () => {
    if (!config || typeof config !== 'object') {
      config = { accept: [] };
      return;
    }
    const accepts = Array.isArray((config as { accept?: unknown }).accept)
      ? normalizeValues((config as { accept?: string[] }).accept ?? [])
      : [];
    config = { accept: accepts };
  };

  ensureConfig();
  $: ensureConfig();

  let accepts: string[] = normalizeValues(config?.accept ?? []);
  $: accepts = normalizeValues(config?.accept ?? []);

  const setAccepts = (next: string[]) => {
    const normalized = normalizeValues(next);
    accepts = normalized;
    config = { ...config, accept: normalized };
  };

  const toggleAccept = (value: string, checked: boolean) => {
    const next = new Set(accepts);
    if (checked) {
      next.add(value);
    } else {
      next.delete(value);
    }
    setAccepts(Array.from(next));
  };

  const setGroupSelection = (groupValues: string[], checked: boolean) => {
    const next = new Set(accepts);
    for (const value of groupValues) {
      if (checked) {
        next.add(value);
      } else {
        next.delete(value);
      }
    }
    setAccepts(Array.from(next));
  };

  const isGroupFullySelected = (groupValues: string[]) => groupValues.every((value) => accepts.includes(value));

  const isGroupPartiallySelected = (groupValues: string[]) =>
    groupValues.some((value) => accepts.includes(value)) && !isGroupFullySelected(groupValues);

  const isChecked = (value: string) => accepts.includes(value);
</script>

<div class="space-y-4 rounded-md border border-gray-200 p-4">
  <h4 class="text-base font-semibold text-gray-800">ファイル設定</h4>

  <fieldset class="space-y-3">
    <legend class="text-sm font-medium text-gray-700">許可するファイルタイプ</legend>
    <p class="text-xs text-gray-500">複数選択できます。未選択の場合は制限しません。</p>
    <div class="space-y-3">
      {#key accepts.join('|')}
        {#each PRESET_GROUPS as group}
          <div class="rounded border border-gray-200 p-3 space-y-2">
            <div class="flex items-center justify-between">
              <p class="text-xs font-semibold text-gray-600">{group.label}</p>
              <label class="flex items-center gap-2 text-xs text-gray-600">
                <input
                  type="checkbox"
                  class="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                  checked={isGroupFullySelected(group.options.map((option) => option.value))}
                  use:indeterminate={isGroupPartiallySelected(group.options.map((option) => option.value))}
                  oninput={(event) =>
                    setGroupSelection(
                      group.options.map((option) => option.value),
                      (event.currentTarget as HTMLInputElement).checked,
                    )}
                />
                <span>すべて選択</span>
              </label>
            </div>
            <div class="grid gap-2 sm:grid-cols-2">
              {#each group.options as option}
                <label class="flex items-center gap-2 text-sm text-gray-700">
                  <input
                    type="checkbox"
                    class="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                    checked={isChecked(option.value)}
                    oninput={(event) => toggleAccept(option.value, (event.currentTarget as HTMLInputElement).checked)}
                  />
                  <span>{option.label}</span>
                </label>
              {/each}
            </div>
          </div>
        {/each}
      {/key}
    </div>
  </fieldset>
</div>

<style>
  @reference '@repo/tailwind-config/tailwind.css';
</style>
