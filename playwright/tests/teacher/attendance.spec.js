import { test, expect } from '@playwright/test';
import { readCsv } from '../../utils/csv-reader.js';
import { TeacherPortal } from '../../pages/TeacherPortal.js';
import { requireAuthenticated } from '../support/require-auth.js';

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

for (const row of readCsv('attendance-scenarios.csv')) {
  test(`teacher attendance: ${row.scenario}`, async ({ page }) => {
    await page.goto('/teacher');
    await requireAuthenticated(page, test.skip);

    const teacher = new TeacherPortal(page);
    await teacher.gotoAttendance();
    await teacher.selectClass(row.className);
    await teacher.selectDate(row.date || todayIso());

    if (row.action === 'all-present') {
      await teacher.markAllPresent();
    } else if (row.action === 'all-absent') {
      await teacher.markAllAbsent();
    }

    await teacher.submitAttendance();

    const expectValid = row.expectValid !== 'false';
    if (expectValid) {
      await expect(page.getByText(/submitted|saved|marked/i)).toBeVisible();
    } else {
      await expect(page.getByText(/invalid|cannot mark|future date|error/i)).toBeVisible();
    }
  });
}
