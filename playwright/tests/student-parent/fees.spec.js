import { test, expect } from '@playwright/test';
import { readCsv } from '../../utils/csv-reader.js';
import { StudentParentPortal } from '../../pages/StudentParentPortal.js';
import { requireAuthenticated } from '../support/require-auth.js';

for (const row of readCsv('fee-payment-scenarios.csv')) {
  test(`fee payment: ${row.scenario}`, async ({ page }) => {
    await page.goto('/student');
    await requireAuthenticated(page, test.skip);

    const portal = new StudentParentPortal(page);
    await portal.gotoFees();
    await portal.payAmount(row.amount);

    if (/^[a-zA-Z]/.test(row.amount)) {
      // CurrencyInput is numeric-only — non-numeric keystrokes never land in the field at all.
      await expect(portal.amountInput()).not.toHaveValue(row.amount);
      return;
    }

    await portal.submitPayment();

    // A "fat-finger" amount (>1.5x outstanding) raises a confirmation dialog rather
    // than failing outright — accept it so the happy path can still be asserted.
    const confirmDialog = page.getByRole('dialog').filter({ hasText: /confirm|are you sure/i });
    if (await confirmDialog.isVisible().catch(() => false)) {
      await confirmDialog.getByRole('button', { name: /confirm|yes|proceed/i }).click();
    }

    const expectValid = row.expectValid === 'true';
    if (expectValid) {
      await expect(page.getByText(/simulated gateway|payment (successful|submitted)/i)).toBeVisible();
    } else {
      await expect(page.getByText(/invalid|must be greater than|error/i)).toBeVisible();
    }
  });
}
