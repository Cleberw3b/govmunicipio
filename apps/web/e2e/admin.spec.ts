import { test, expect } from '@playwright/test';

test.describe('Admin — Protected Routes', () => {
  for (const route of ['/admin', '/admin/municipalities', '/admin/hospitals']) {
    test(`accessing ${route} without auth redirects to login`, async ({ page }) => {
      await page.goto(route);
      await page.waitForLoadState('networkidle');
      await expect(page.getByRole('button', { name: 'Entrar' })).toBeVisible();
      await expect(page.getByLabel('Usuário')).toBeVisible();
    });
  }
});
