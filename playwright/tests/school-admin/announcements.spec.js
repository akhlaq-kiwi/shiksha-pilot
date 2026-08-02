import { test, expect } from '@playwright/test';
import { readCsv } from '../../utils/csv-reader.js';
import { SchoolAdminPortal } from '../../pages/SchoolAdminPortal.js';
import { requireAuthenticated } from '../support/require-auth.js';

for (const row of readCsv('announcement-scenarios.csv')) {
  test(`announcement: ${row.scenario}`, async ({ page }) => {
    await page.goto('/school-admin');
    await requireAuthenticated(page, test.skip);

    const schoolAdmin = new SchoolAdminPortal(page);
    await schoolAdmin.gotoAnnouncements();
    await schoolAdmin.createAnnouncement(row.title);

    const expectValid = row.expectValid === 'true';
    if (expectValid) {
      await expect(page.getByText(new RegExp(row.title.slice(0, 20), 'i'))).toBeVisible();
    } else {
      await expect(page.getByText(/required|too long|error/i)).toBeVisible();
    }
  });
}
