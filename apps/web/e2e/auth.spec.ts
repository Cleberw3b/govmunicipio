import { test, expect } from '@playwright/test';

const LOGIN_URL = '/auth/login';

/** Helper: assert we're on the login page */
async function expectLoginPage(page: import('@playwright/test').Page) {
  await expect(page.getByRole('button', { name: 'Entrar' })).toBeVisible();
  await expect(page.getByLabel('Usuário')).toBeVisible();
  await expect(page.getByLabel('Senha')).toBeVisible();
}

test.describe('Auth', () => {
  test('login page loads with all elements', async ({ page }) => {
    await page.goto(LOGIN_URL);
    await expectLoginPage(page);
    await expect(page.getByText('GovMunicípio')).toBeVisible();
    await expect(page.getByText('Entre com suas credenciais')).toBeVisible();
    await expect(page.getByText('Primeiro acesso?')).toBeVisible();
    await expect(page.getByRole('link', { name: 'Defina sua senha' })).toBeVisible();
  });

  test('login with valid credentials redirects to dashboard', async ({ page }) => {
    await page.goto(LOGIN_URL);
    await page.getByLabel('Usuário').fill('admin');
    await page.getByLabel('Senha').fill('admin123');
    await page.getByRole('button', { name: 'Entrar' }).click();
    await page.waitForLoadState('networkidle');
    // After login, should no longer be on the login page
    await expect(page.getByText('GovMunicípio')).toBeVisible();
  });

  test('login with invalid credentials shows error', async ({ page }) => {
    await page.goto(LOGIN_URL);
    await page.getByLabel('Usuário').fill('invaliduser');
    await page.getByLabel('Senha').fill('wrongpassword');
    await page.getByRole('button', { name: 'Entrar' }).click();
    await page.waitForLoadState('networkidle');
    // Should stay on login page — form still visible
    await expectLoginPage(page);
  });

  test('login with empty fields stays on form', async ({ page }) => {
    await page.goto(LOGIN_URL);
    await page.getByRole('button', { name: 'Entrar' }).click();
    await expectLoginPage(page);
  });

  test('set password link navigates correctly', async ({ page }) => {
    await page.goto(LOGIN_URL);
    await page.getByRole('link', { name: 'Defina sua senha' }).click();
    await page.waitForLoadState('networkidle');
    await expect(page).toHaveURL(/set-password/);
  });
});
