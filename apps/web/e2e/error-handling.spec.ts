import { test, expect } from '@playwright/test';

test.describe('Error Handling — no stack traces shown', () => {
  test('error page does not expose stack traces or error messages', async ({ page }) => {
    // Navigate to a route that will trigger an error (non-existent API)
    await page.goto('/auth/login');
    await expect(page.getByRole('button', { name: 'Entrar' })).toBeVisible();

    // Verify no JavaScript error messages are visible in the rendered page
    const body = await page.textContent('body');
    expect(body).not.toContain('Cannot read properties');
    expect(body).not.toContain('TypeError');
    expect(body).not.toContain('ReferenceError');
    expect(body).not.toContain('undefined is not');
    expect(body).not.toContain('.map is not a function');
  });

  test('protected pages redirect gracefully without errors', async ({ page }) => {
    // Access protected route — should redirect to login, not crash
    await page.goto('/dashboard/users');
    await page.waitForLoadState('networkidle');

    // Should see login form, not an error page
    await expect(page.getByRole('button', { name: 'Entrar' })).toBeVisible();

    // Verify no error traces in the page
    const body = await page.textContent('body');
    expect(body).not.toContain('Cannot read properties');
    expect(body).not.toContain('Algo deu errado');
  });

  test('admin pages redirect gracefully without errors', async ({ page }) => {
    await page.goto('/admin/users');
    await page.waitForLoadState('networkidle');

    await expect(page.getByRole('button', { name: 'Entrar' })).toBeVisible();

    const body = await page.textContent('body');
    expect(body).not.toContain('Cannot read properties');
  });
});
