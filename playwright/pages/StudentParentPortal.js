import { AppShellPage } from './AppShellPage.js';

/**
 * Student/parent portal (frontend/src/features/student-parent/*). Same
 * component serves both /student and /parent routes; a parent additionally
 * gets a child switcher (StudentIdentityHeader).
 */
export class StudentParentPortal extends AppShellPage {
  /** @param {import('@playwright/test').Page} page */
  constructor(page) {
    super(page);
    this.page = page;
    this.childSwitcher = page.getByLabel(/switch child|child-switcher/i);
  }

  async gotoFees() {
    await this.goToNavItem('Fees');
  }

  async switchChild(childName) {
    await this.childSwitcher.selectOption({ label: childName });
  }

  // ---- Fees (pages/FeesPage.jsx) --------------------------------------------

  amountInput() {
    return this.page.getByLabel(/amount/i);
  }

  async payAmount(amount) {
    await this.amountInput().fill(String(amount));
  }

  async submitPayment() {
    await this.page.getByRole('button', { name: /pay|proceed/i }).click();
  }

  async downloadReceipt(rowName) {
    const [download] = await Promise.all([
      this.page.waitForEvent('download'),
      this.page.getByRole('row', { name: new RegExp(rowName, 'i') }).getByRole('button', { name: /download/i }).click(),
    ]);
    return download;
  }
}
