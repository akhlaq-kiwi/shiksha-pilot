import { test, expect } from '@playwright/test';
import { readCsv } from '../../utils/csv-reader.js';
import { SuperAdminPortal } from '../../pages/SuperAdminPortal.js';
import { requireAuthenticated } from '../support/require-auth.js';

for (const row of readCsv('plan-scenarios.csv')) {
  test(`plan management: ${row.scenario}`, async ({ page }) => {
    await page.goto('/super-admin');
    await requireAuthenticated(page, test.skip);

    const superAdmin = new SuperAdminPortal(page);
    await superAdmin.gotoPlans();

    // These tests create real plans and this suite isn't run against a
    // disposable DB per run — delete every same-named plan left over from a
    // previous run so "create" doesn't collide with a duplicate-name check.
    if (row.planName) {
      // "Active"/"Inactive" tab filters can hide some duplicates — show everything first.
      await page.getByRole('button', { name: /^all plans$/i }).click();

      const existingCard = () => page
        .getByRole('heading', { name: row.planName, exact: true })
        .locator('xpath=ancestor::*[contains(@class, "rounded-2xl")][1]');

      for (let guard = 0; guard < 20; guard++) {
        const count = await existingCard().count();
        if (count === 0) break;

        await existingCard().first().getByRole('button', { name: /delete/i }).click();
        // ConfirmDialog.jsx is also a hand-rolled <div> overlay (no role="dialog"),
        // heading "Delete Plan?" with a "Delete" confirm button.
        await page.getByRole('heading', { name: /delete plan/i }).waitFor();
        await page.getByRole('button', { name: /^delete$/i }).last().click();
        // Wait for that specific card to actually leave the DOM before re-counting.
        await expect(existingCard()).toHaveCount(count - 1, { timeout: 10_000 });
      }
    }

    await superAdmin.openCreatePlanDialog();
    await superAdmin.fillPlanForm(row);
    await superAdmin.submitPlanForm();

    const planNameField = page.getByLabel(/plan name/i);
    const expectValid = row.expectValid === 'true';

    if (expectValid) {
      // What actually matters is the plan getting created — assert on that
      // directly rather than on modal-close timing (PlanDialog is a
      // hand-rolled overlay, not the shared Dialog primitive, so its close
      // animation/state isn't guaranteed to settle within a fixed window).
      await expect(page.getByText(new RegExp(row.planName, 'i')).first()).toBeVisible({ timeout: 15_000 });
    } else {
      // Plan Name is `required`; Amount has a native min="0" constraint —
      // either blocks submission via the browser's own constraint validation
      // rather than app-rendered error text.
      const nameValid = await planNameField.evaluate((el) => el.checkValidity());
      const amountValid = await page.getByLabel(/amount/i).evaluate((el) => el.checkValidity());
      expect(nameValid && amountValid).toBe(false);
    }
  });
}
