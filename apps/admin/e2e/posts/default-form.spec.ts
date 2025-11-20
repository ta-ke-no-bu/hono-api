import { expect, test } from '@playwright/test';

const postTitle = `デフォルト投稿テスト ${new Date().toISOString()}`;

test.describe('テンプレート無し投稿', () => {
  test.beforeEach(async ({ page }) => {
    // テストユーザーでログイン
    await page.goto('/login');
    await page.fill('input[name="email"]', process.env.ADMIN_E2E_EMAIL!);
    await page.fill('input[name="password"]', process.env.ADMIN_E2E_PASSWORD!);
    await page.click('button[type="submit"]');
    await page.waitForURL('/dashboard');

    // TODO: APIを叩いて、すべてのPostSettingをINACTIVEにするか、削除する
  });

  test('デフォルトフォームから投稿を作成できる', async ({ page }) => {
    await page.goto('/posts');

    // 「新規投稿」ボタンをクリック
    await page.click('a:has-text("新規投稿を作成")');

    // デフォルトフォームに遷移することを確認
    await page.waitForURL('/posts/new');
    await expect(page.locator('text=デフォルト投稿フォーム')).toBeVisible();

    // フォームを入力
    await page.fill('input[name="title"]', postTitle);
    await page.fill('input[name="publishedAt"]', '2025-10-21');
    await page.locator('.tiptap-container').fill('これはテスト投稿の本文です。');

    // 投稿を作成
    await page.click('button[type="submit"]:has-text("投稿を作成")');

    // 投稿一覧にリダイレクトされ、作成した投稿が表示されることを確認
    await page.waitForURL('/posts');
    await expect(page.locator(`text=${postTitle}`)).toBeVisible();
  });

  test('デフォルト設定が無効な場合にエラーが表示される', async ({ page }) => {
    // TODO: APIを叩いて、`post-default` のPostSettingをINACTIVEにする

    await page.goto('/posts');
    await page.click('a:has-text("新規投稿を作成")');
    await page.waitForURL('/posts/new');

    await page.fill('input[name="title"]', 'エラーテスト');
    await page.click('button[type="submit"]');

    // エラーメッセージが表示されることを確認
    await expect(page.locator('text=既定の投稿設定が無効です')).toBeVisible();
  });
});
