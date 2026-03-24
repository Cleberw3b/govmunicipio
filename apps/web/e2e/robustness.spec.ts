import { test, expect } from '@playwright/test';

test.describe('Robustness — input fuzzing', () => {
  test('login with very long username does not crash', async ({ page }) => {
    await page.goto('/auth/login');
    const longUsername = 'a'.repeat(1000);
    await page.getByLabel('Usuário').fill(longUsername);
    await page.getByLabel('Senha').fill('password');
    await page.getByRole('button', { name: 'Entrar' }).click();
    await page.waitForLoadState('networkidle');
    // Should show error or stay on login, not crash
    const body = await page.textContent('body');
    expect(body).not.toContain('Cannot read properties');
    expect(body).not.toContain('TypeError');
  });

  test('login with HTML/script injection does not crash or execute', async ({ page }) => {
    await page.goto('/auth/login');
    await page.getByLabel('Usuário').fill('<script>alert("xss")</script>');
    await page.getByLabel('Senha').fill('\'; DROP TABLE principals; --');
    await page.getByRole('button', { name: 'Entrar' }).click();
    await page.waitForLoadState('networkidle');
    // Should not execute script or crash
    const body = await page.textContent('body');
    expect(body).not.toContain('TypeError');
    // Page should still have the login form or show an error
    await expect(page.getByLabel('Usuário')).toBeVisible();
  });

  test('rapid navigation between routes does not crash', async ({ page }) => {
    const routes = ['/auth/login', '/dashboard', '/tfd/requests', '/admin', '/auth/login'];
    for (const route of routes) {
      await page.goto(route);
    }
    await page.waitForLoadState('networkidle');
    const body = await page.textContent('body');
    expect(body).not.toContain('Cannot read properties');
    expect(body).not.toContain('TypeError');
  });

  test('double-click login button does not cause errors', async ({ page }) => {
    await page.goto('/auth/login');
    await page.getByLabel('Usuário').fill('admin');
    await page.getByLabel('Senha').fill('admin123');
    const button = page.getByRole('button', { name: 'Entrar' });
    await button.dblclick();
    await page.waitForLoadState('networkidle');
    const body = await page.textContent('body');
    expect(body).not.toContain('TypeError');
  });

  test('empty form submission does not crash', async ({ page }) => {
    await page.goto('/auth/login');
    await page.getByRole('button', { name: 'Entrar' }).click();
    // Should stay on login form
    await expect(page.getByLabel('Usuário')).toBeVisible();
    const body = await page.textContent('body');
    expect(body).not.toContain('Cannot read properties');
  });
});
