import { test, expect } from '@playwright/test';
import { readCsv } from '../../utils/csv-reader.js';
import { TeacherPortal } from '../../pages/TeacherPortal.js';
import { requireAuthenticated } from '../support/require-auth.js';

for (const row of readCsv('leave-request-scenarios.csv')) {
  test(`teacher leave request: ${row.scenario}`, async ({ page }) => {
    await page.goto('/teacher');
    await requireAuthenticated(page, test.skip);

    const teacher = new TeacherPortal(page);
    await teacher.gotoLeave();
    await teacher.fillLeaveRequest(row);
    await teacher.submitLeaveRequest();

    const expectValid = row.expectValid === 'true';
    if (expectValid) {
      await expect(page.getByText(/submitted|pending|success/i)).toBeVisible();
    } else {
      await expect(page.getByText(/required|invalid|before start date|100 words|error/i)).toBeVisible();
    }
  });
}
