import { AppShellPage } from './AppShellPage.js';

/** Super admin portal (frontend/src/features/super-admin/*). */
export class SuperAdminPortal extends AppShellPage {
  /** @param {import('@playwright/test').Page} page */
  constructor(page) {
    super(page);
    this.page = page;
  }

  async gotoSchools() {
    await this.goToNavItem('Schools');
  }

  async gotoPlans() {
    await this.goToNavItem('Plans');
  }

  async openCreateSchoolDialog() {
    await this.page.getByRole('button', { name: /create school|add school|new school/i }).click();
  }

  dialog() {
    return this.page.getByRole('dialog');
  }

  statCard(label) {
    return this.page.getByText(label, { exact: false }).locator('..');
  }

  // ---- Plans (pages/PlansPage.jsx) ------------------------------------------

  async openCreatePlanDialog() {
    await this.page.getByRole('button', { name: /new plan/i }).click();
    // PlanDialog is a hand-rolled <div> modal, not role="dialog" — wait on a field it contains instead.
    await this.page.getByLabel(/plan name/i).waitFor();
  }

  async fillPlanForm({ planName, studentLimit, price }) {
    if (planName) await this.page.getByLabel(/plan name/i).fill(planName);
    if (studentLimit) await this.page.getByLabel(/student limit/i).fill(String(studentLimit));
    if (price) await this.page.getByLabel(/amount/i).fill(String(price));
    // Description is also `required` (native HTML5) despite having no <label htmlFor> —
    // leaving it blank silently blocks submission with the browser's own validation bubble.
    await this.page.getByPlaceholder(/features and standard services/i).fill('E2E test plan.');
  }

  async submitPlanForm() {
    await this.page.getByRole('button', { name: /create plan|save changes/i }).click();
  }
}
