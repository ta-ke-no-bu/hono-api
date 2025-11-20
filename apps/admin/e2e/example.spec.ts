import { expect, test } from '@playwright/test';

test('has title', async ({ page }) => {
  await page.goto('http://localhost:5173');

  // Expect a title "to contain" a substring.
  await expect(page).toHaveTitle(/SvelteKit/);
});

// 'get started link' テストを 'has heading' テストに書き換える
test('has heading', async ({ page }) => {
  await page.goto('http://localhost:5173');

  // Expects page to have a heading with the name of Welcome to SvelteKit.
  await expect(page.getByRole('heading', { name: 'Welcome to SvelteKit' })).toBeVisible();
});
