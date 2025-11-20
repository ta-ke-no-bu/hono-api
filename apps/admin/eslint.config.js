import antfu from '@antfu/eslint-config';

export default antfu({
  svelte: true,
  rules: {
    'svelte/html-quotes': 'off',
    'svelte/indent': 'off',
    'style/operator-linebreak': 'off',
    'style/member-delimiter-style': 'off',
    'style/brace-style': 'off',
    'style/quote-props': 'off',
    'style/quotes': ['error', 'single', { avoidEscape: true, allowTemplateLiterals: true }],
    'antfu/if-newline': 'off',
    'style/indent-binary-ops': 'off',
    'no-alert': 'off',
    'node/prefer-global/process': 'off',
    // Biome と競合する可能性のあるルールを無効化
    'style/semi': 'off', // Biome がセミコロンを管理
    'jsonc/sort-keys': 'off', // Biome が JSON キーの順序を管理
    'perfectionist/sort-imports': 'off', // Biome がインポート順序を管理
    'style/arrow-parens': 'off', // Biome がアロー関数の括弧を管理
    // 未使用インポートは Biome が検出するので ESLint 側では無効化
    'unused-imports/no-unused-imports': 'off',
    // test/consistent-test-it は Vitest のルールなので、ESLint 側で無効化するか、Vitest の設定で調整
    'test/consistent-test-it': 'off',
  },
});
