import { test, expect } from '@playwright/test';
import { readCsv } from '../../utils/csv-reader.js';
import { SuperAdminPortal } from '../../pages/SuperAdminPortal.js';
import { requireAuthenticated } from '../support/require-auth.js';

for (const row of readCsv('school-creation.csv')) {
  test(`school creation: ${row.scenario}`, async ({ page }) => {
    await page.goto('/super-admin');
    await requireAuthenticated(page, test.skip);

    const superAdmin = new SuperAdminPortal(page);
    await superAdmin.gotoSchools();
    await superAdmin.openCreateSchoolDialog();

    const dialog = superAdmin.dialog();
    const nameInput = dialog.getByLabel(/school name/i);
    const emailInput = dialog.getByLabel(/school owner email address/i);
    if (row.schoolName) await nameInput.fill(row.schoolName);
    if (row.ownerEmail) await emailInput.fill(row.ownerEmail);
    if (row.contactPhone) await dialog.getByLabel(/contact phone/i).fill(row.contactPhone);
    await dialog.getByRole('button', { name: /create school/i }).click();

    const expectValid = row.expectValid === 'true';
    if (expectValid) {
      await expect(page.getByText(new RegExp(row.schoolName, 'i')).first()).toBeVisible();
      return;
    }

    // Both required-field and email-format checks here are native HTML5
    // constraint validation (required / type=email) — the browser blocks
    // submission silently rather than showing a custom error message.
    const nameValid = await nameInput.evaluate((el) => el.checkValidity());
    const emailValid = await emailInput.evaluate((el) => el.checkValidity());
    expect(nameValid && emailValid).toBe(false);
    await expect(dialog).toBeVisible();
  });
}
