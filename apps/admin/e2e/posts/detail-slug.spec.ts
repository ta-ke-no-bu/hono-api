import { expect, test } from '@playwright/test';

const BASE_URL = process.env.ADMIN_E2E_BASE_URL ?? 'http://localhost:5173';

const LOGIN_EMAIL = process.env.ADMIN_E2E_EMAIL ?? 'admin@example.com';
const LOGIN_PASSWORD = process.env.ADMIN_E2E_PASSWORD ?? 'password';

test.describe('投稿作成/編集 詳細ページ slug', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(`${BASE_URL}/login`);
    if (
      await page
        .getByRole('heading', { name: 'ダッシュボード' })
        .isVisible({ timeout: 1000 })
        .catch(() => false)
    ) {
      return;
    }
    await page.getByLabel('メールアドレス').fill(LOGIN_EMAIL);
    await page.getByLabel('パスワード').fill(LOGIN_PASSWORD);
    await page.getByRole('button', { name: 'ログイン' }).click();
    await expect(page.getByRole('heading', { name: 'ダッシュボード' })).toBeVisible();
  });

  test('detail slug 入力・検証フロー', async ({ page }) => {
    await page.goto(`${BASE_URL}/posts/new`);
    const settingSelect = page.getByLabel('投稿設定');
    await expect(settingSelect).toBeVisible();
    const firstSetting = await settingSelect.locator('option').nth(1).getAttribute('value');
    if (!firstSetting) {
      test.skip(true, '投稿設定が存在しないためテストをスキップ');
    }
    await settingSelect.selectOption(firstSetting!);
    const detailCheckbox = page.getByRole('checkbox', { name: /詳細ページを生成/ });
    await detailCheckbox.check();
    const slugInput = page.getByLabel('詳細ページ slug');
    await expect(slugInput).toBeVisible();
    await slugInput.fill('INVALID SLUG');
    await page.getByLabel('タイトル').focus();
    await expect(page.getByRole('alert')).toContainText('slugは半角英数字とハイフンのみ利用できます。');
    await slugInput.fill('valid-slug');
    await page.getByLabel('タイトル').fill('Playwright slug test');
    await page.getByLabel('カテゴリ').selectOption({ index: 1 });
    await page.getByLabel('公開日').fill('2025-10-20');
    await page.getByRole('button', { name: '投稿を作成' }).click();
    await expect(page).toHaveURL(/\/posts$/);
    const createdRow = page.locator('table tbody tr').filter({ hasText: 'Playwright slug test' });
    await expect(createdRow).toBeVisible();
    await expect(createdRow).toContainText('生成済み（valid-slug）');
    const detailLink = await createdRow.locator('a[href*="/posts/"]').first().getAttribute('href');
    if (!detailLink) {
      throw new Error('作成した投稿の編集リンクが取得できませんでした');
    }
    const postId = detailLink.split('/').at(-1);
    if (!postId) {
      throw new Error('投稿IDが取得できませんでした');
    }
    await page.goto(`${BASE_URL}/posts/${postId}`);
    const editSlugInput = page.getByLabel('詳細ページ slug');
    await expect(editSlugInput).toHaveValue(/valid-slug$/);
    await editSlugInput.fill('another-slug');
    await page.getByRole('button', { name: '投稿を更新' }).click();
    await expect(page).toHaveURL(`${BASE_URL}/posts`);
    const updatedRow = page.locator('table tbody tr').filter({ hasText: 'Playwright slug test' });
    await expect(updatedRow).toBeVisible();
    await expect(updatedRow).toContainText('生成済み（another-slug）');
  });
});
