<svelte:options runes={false} />
<script lang="ts">
  type DateConfigValue = { mode?: 'date' | 'datetime' };

  export let config: DateConfigValue | null = null;

  let workingConfig: DateConfigValue = { mode: 'date' };

  $: {
    if (!config || typeof config !== 'object' || Array.isArray(config)) {
      workingConfig = { mode: 'date' };
      config = workingConfig;
    } else {
      workingConfig = config;
      if (!workingConfig.mode) {
        workingConfig.mode = 'date';
      }
    }
  }
</script>

<div class="space-y-2 rounded-md border border-gray-200 p-4">
  <h4 class="font-medium text-gray-800">日付設定</h4>
  <div class="flex items-center space-x-4">
    <div class="flex items-center">
      <input
        id="mode-date"
        type="radio"
        name="date-mode"
        value="date"
        class="h-4 w-4 border-gray-300 text-indigo-600 focus:ring-indigo-500"
        bind:group={workingConfig.mode}
      />
      <label for="mode-date" class="ml-2 block text-sm text-gray-900">日付のみ</label>
    </div>
    <div class="flex items-center">
      <input
        id="mode-datetime"
        type="radio"
        name="date-mode"
        value="datetime"
        class="h-4 w-4 border-gray-300 text-indigo-600 focus:ring-indigo-500"
        bind:group={workingConfig.mode}
      />
      <label for="mode-datetime" class="ml-2 block text-sm text-gray-900">日時（時刻まで）</label>
    </div>
  </div>
</div>
