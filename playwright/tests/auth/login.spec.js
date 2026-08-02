import { test, expect } from '@playwright/test';
import { readCsv } from '../../utils/csv-reader.js';
import { LoginPage } from '../../pages/LoginPage.js';

test.describe('Login form validation (server-driven)', () => {
  for (const row of readCsv('login-invalid-attempts.csv')) {
    test(`shows an error for: ${row.case}`, async ({ page }) => {
      const loginPage = new LoginPage(page);
      await loginPage.goto();
      await loginPage.login(row.phone, row.password);

      const errorLocator = row.expectedFieldError === 'phone' ? loginPage.phoneError : loginPage.passwordError;
      await expect(errorLocator).toBeVisible();
      await expect(page).toHaveURL(/\/login/);
    });
  }
});

test.describe('Login form validation (native required fields)', () => {
  for (const row of readCsv('login-required-fields.csv')) {
    test(`blocks submission for: ${row.case}`, async ({ page }) => {
      const loginPage = new LoginPage(page);
      await loginPage.goto();
      await loginPage.login(row.phone, row.password);

      // Native constraint validation prevents the submit event from firing at all.
      const isValid = await page.getByTestId(row.emptyFieldTestid).evaluate((el) => el.checkValidity());
      expect(isValid).toBe(false);
      await expect(page).toHaveURL(/\/login/);
    });
  }
});

test.describe('Login success (per role)', () => {
  for (const row of readCsv('login-credentials.csv')) {
    const password = process.env[row.passwordEnvVar];
    const skip = row.skip === '1' || !row.phone || !password;

    test(`${row.role} can log in and lands on their portal home`, async ({ page }) => {
      test.skip(skip, `No phone/${row.passwordEnvVar} configured for ${row.role} — see playwright/.env.example`);

      const loginPage = new LoginPage(page);
      await loginPage.goto();
      await loginPage.loginAndWaitForRedirect(row.phone, password);
      await expect(page).not.toHaveURL(/\/login/);
    });
  }
});
