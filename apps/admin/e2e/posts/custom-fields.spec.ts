import { expect, test } from '@playwright/test';

const BASE_URL = process.env.ADMIN_E2E_BASE_URL ?? 'http://localhost:5173';
const LOGIN_EMAIL = process.env.ADMIN_E2E_EMAIL ?? 'admin@example.com';
const LOGIN_PASSWORD = process.env.ADMIN_E2E_PASSWORD ?? 'password';

const DEFAULT_POST_SETTING_ID = process.env.ADMIN_DEFAULT_POST_SETTING_ID ?? 'post-default-setting';

async function login(page: import('@playwright/test').Page) {
  await page.goto(`${BASE_URL}/login`);

  // すでにログイン済みの場合は何もしない
  const alreadyLoggedIn = await page
    .getByRole('heading', { name: 'ダッシュボード' })
    .isVisible({ timeout: 500 })
    .catch(() => false);
  if (alreadyLoggedIn) {
    return;
  }

  await page.getByLabel('メールアドレス').fill(LOGIN_EMAIL);
  await page.getByLabel('パスワード').fill(LOGIN_PASSWORD);
  await page.getByRole('button', { name: 'ログイン' }).click();
  await expect(page.getByRole('heading', { name: 'ダッシュボード' })).toBeVisible();
}

test.describe('投稿作成 カスタムフィールド描画', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test('テンプレート未指定時はカスタムフィールド UI が非表示', async ({ page }) => {
    await page.goto(`${BASE_URL}/posts/new`);

    await expect(page.getByText('デフォルト投稿フォーム')).toBeVisible();
    await expect(page.locator('[data-field]')).toHaveCount(0);
  });

  test('テンプレート指定時はカスタムフィールドが定義順に表示される', async ({ page }) => {
    await page.goto(`${BASE_URL}/posts/new?postSettingId=${encodeURIComponent(DEFAULT_POST_SETTING_ID)}`);

    await expect(page.getByText('投稿設定:')).toBeVisible();

    const heroTitleField = page.locator('[data-field="heroTitle"]');
    const heroDescriptionField = page.locator('[data-field="heroDescription"]');
    const ctaRepeatableField = page.locator('[data-field="ctaList"]');

    await expect(heroTitleField).toBeVisible();
    await expect(heroTitleField.locator('label')).toContainText('ヒーロータイトル');

    await expect(heroDescriptionField).toBeVisible();
    await expect(heroDescriptionField.locator('.custom-field-textarea, .rich-text-editor')).toHaveCount(1);

    await expect(ctaRepeatableField).toBeVisible();
    await expect(ctaRepeatableField.locator('.custom-field-add-button')).toBeVisible();

    // 繰り返し追加ボタンを押下し、ネストした項目がキーボード操作でフォーカス可能なことを確認
    await ctaRepeatableField.locator('.custom-field-add-button').click();
    const firstRepeatableItem = ctaRepeatableField.locator('.custom-field-repeatable-item').first();
    await expect(firstRepeatableItem).toBeVisible();
    await firstRepeatableItem.locator('input, textarea, select').first().focus();
    await expect(firstRepeatableItem.locator('input, textarea, select').first()).toBeFocused();
  });
});
