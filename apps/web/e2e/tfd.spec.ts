import { test, expect } from '@playwright/test';

test.describe('TFD — Protected Routes', () => {
  for (const route of ['/tfd/requests', '/tfd/requests/new']) {
    test(`accessing ${route} without auth redirects to login`, async ({ page }) => {
      await page.goto(route);
      await page.waitForLoadState('networkidle');
      await expect(page.getByRole('button', { name: 'Entrar' })).toBeVisible();
      await expect(page.getByLabel('Usuário')).toBeVisible();
    });
  }
});

test.describe('TFD — Lifecycle (requires API)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/auth/login');
    await page.getByLabel('Usuário').fill('admin');
    await page.getByLabel('Senha').fill('admin123');
    await page.getByRole('button', { name: 'Entrar' }).click();
    await page.waitForLoadState('networkidle');
  });

  test('can navigate to TFD request list', async ({ page }) => {
    await page.goto('/tfd/requests');
    await page.waitForLoadState('networkidle');
    // Verify the page loads (content depends on API availability)
    await expect(page.getByText('GovMunicípio')).toBeVisible();
  });

  test('can navigate to new TFD request form', async ({ page }) => {
    await page.goto('/tfd/requests/new');
    await page.waitForLoadState('networkidle');
    await expect(page.getByText('GovMunicípio')).toBeVisible();
  });
});
