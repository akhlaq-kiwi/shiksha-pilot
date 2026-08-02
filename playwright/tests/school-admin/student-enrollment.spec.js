import { test, expect } from '@playwright/test';
import { readCsv } from '../../utils/csv-reader.js';
import { SchoolAdminPortal } from '../../pages/SchoolAdminPortal.js';
import { requireAuthenticated } from '../support/require-auth.js';

const TEST_CLASS = 'Class 5';

for (const row of readCsv('student-enrollment.csv')) {
  test(`student enrollment: ${row.scenario}`, async ({ page }) => {
    await page.goto('/school-admin');
    await requireAuthenticated(page, test.skip);

    const schoolAdmin = new SchoolAdminPortal(page);
    await schoolAdmin.gotoStudentEnrollment(TEST_CLASS);

    if (row.studentName) await schoolAdmin.fillEnrollmentField('Student Name', row.studentName);
    if (row.dob) await schoolAdmin.fillDateOfBirth(row.dob);
    if (row.email) await schoolAdmin.fillEnrollmentField('Student Email', row.email);
    if (row.mobile) await schoolAdmin.fillEnrollmentField('Contact Number', row.mobile);
    if (row.aadhaar) await schoolAdmin.fillEnrollmentField('Aadhaar Number', row.aadhaar);

    await schoolAdmin.goToNextEnrollmentStep();

    const expectValid = row.expectValid === 'true';
    if (expectValid) {
      // Step 1 passed validation — Address step should now be visible.
      await expect(page.getByText(/address/i).first()).toBeVisible();
    } else {
      // Blocked on step 1 — an inline error appears and no step advance happens.
      await expect(page.getByText(/required|invalid|must be|error/i)).toBeVisible();
    }
  });
}
