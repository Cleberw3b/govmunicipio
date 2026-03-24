import { test, expect } from '@playwright/test';

test.describe('Accessibility', () => {
  test('skip-to-content link is present in DOM', async ({ page }) => {
    await page.goto('/auth/login');
    const skipLink = page.getByRole('link', { name: 'Pular para o conteúdo' });
    await expect(skipLink).toBeAttached();
  });

  test('keyboard navigation through login form', async ({ page }) => {
    await page.goto('/auth/login');
    await expect(page.getByRole('button', { name: 'Entrar' })).toBeVisible();

    // Tab through form elements and type
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');
    await page.keyboard.type('testuser');
    await page.keyboard.press('Tab');
    await page.keyboard.type('testpass');

    // Form should still be visible (no premature submission)
    await expect(page.getByRole('button', { name: 'Entrar' })).toBeVisible();
  });

  test('page renders in Portuguese', async ({ page }) => {
    await page.goto('/auth/login');
    await expect(page.getByText('Entre com suas credenciais')).toBeVisible();
    await expect(page.getByLabel('Usuário')).toBeVisible();
    await expect(page.getByLabel('Senha')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Entrar' })).toBeVisible();
  });
});
