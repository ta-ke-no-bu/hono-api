<script lang="ts">
  type ValidationState = {
    required?: boolean;
    minLength?: number;
    maxLength?: number;
  };

  export let validation: ValidationState | null | undefined = {};
  export let fieldType: string;

  const ensureState = () => {
    if (!validation || typeof validation !== 'object') {
      validation = {};
    }
  };

  ensureState();

  const toggleRequired = (checked: boolean) => {
    ensureState();
    validation = { ...validation, required: checked };
  };

  const updateNumber = (key: 'minLength' | 'maxLength', value: string) => {
    ensureState();
    const trimmed = value.trim();
    if (!trimmed) {
      const { [key]: _removed, ...rest } = validation ?? {};
      validation = rest;
      return;
    }
    const parsed = Number.parseInt(trimmed, 10);
    if (!Number.isNaN(parsed)) {
      validation = { ...validation, [key]: parsed };
    }
  };

  const numberValue = (key: 'minLength' | 'maxLength') => {
    if (!validation) {
      return '';
    }
    const value = validation[key];
    return typeof value === 'number' ? String(value) : '';
  };
</script>

<div class="space-y-2 rounded-md border border-gray-200 p-4">
  <h4 class="font-medium text-gray-800">バリデーション設定</h4>

  <div class="flex items-center">
    <input
      id="validation-required"
      type="checkbox"
      class="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
      checked={Boolean(validation?.required)}
      oninput={(event) => toggleRequired((event.currentTarget as HTMLInputElement).checked)}
    />
    <label for="validation-required" class="ml-2 block text-sm text-gray-900">必須項目にする</label>
  </div>

  {#if fieldType === 'text' || fieldType === 'richText'}
    <div class="grid grid-cols-2 gap-4">
      <div>
        <label for="validation-minLength" class="label">最小文字数</label>
        <input
          id="validation-minLength"
          type="number"
          min="0"
          class="input"
          value={numberValue('minLength')}
          oninput={(event) => updateNumber('minLength', (event.currentTarget as HTMLInputElement).value)}
        />
      </div>
      <div>
        <label for="validation-maxLength" class="label">最大文字数</label>
        <input
          id="validation-maxLength"
          type="number"
          min="0"
          class="input"
          value={numberValue('maxLength')}
          oninput={(event) => updateNumber('maxLength', (event.currentTarget as HTMLInputElement).value)}
        />
      </div>
    </div>
  {/if}

  <!-- TODO: 他のフィールドタイプごとのバリデーション項目 -->
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
