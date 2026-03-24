import { test, expect } from '@playwright/test';

test.describe('Protected Routes — redirect to login', () => {
  for (const route of ['/dashboard', '/tfd/requests', '/admin']) {
    test(`accessing ${route} without auth redirects to login`, async ({ page }) => {
      await page.goto(route);
      await page.waitForLoadState('networkidle');
      // Should see the login form
      await expect(page.getByRole('button', { name: 'Entrar' })).toBeVisible();
      await expect(page.getByLabel('Usuário')).toBeVisible();
      await expect(page.getByLabel('Senha')).toBeVisible();
    });
  }
});
