import { test, expect } from '@playwright/test';
import { readCsv } from '../../utils/csv-reader.js';
import { TeacherPortal } from '../../pages/TeacherPortal.js';
import { requireAuthenticated } from '../support/require-auth.js';

for (const row of readCsv('marks-scenarios.csv')) {
  test(`teacher marks entry: ${row.scenario}`, async ({ page }) => {
    await page.goto('/teacher');
    await requireAuthenticated(page, test.skip);

    const teacher = new TeacherPortal(page);
    await teacher.gotoExamination();
    await teacher.enterMarkForStudent(row.studentName, row.marks);
    await teacher.submitMarks();

    const expectValid = row.expectValid === 'true';
    if (expectValid) {
      await expect(page.getByText(/submitted|saved/i)).toBeVisible();
    } else {
      await expect(page.getByText(/invalid|out of range|error/i)).toBeVisible();
    }
  });
}
