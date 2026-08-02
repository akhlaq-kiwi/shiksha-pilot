import { AppShellPage } from './AppShellPage.js';

/**
 * School admin portal (frontend/src/features/school-admin/*).
 * Nav items carry a display `label` distinct from the server-matched
 * `permissionKey` (e.g. label "Fee collection" -> permissionKey "Fees Portal") —
 * always navigate by the visible label here, same as a real user would.
 */
export class SchoolAdminPortal extends AppShellPage {
  /** @param {import('@playwright/test').Page} page */
  constructor(page) {
    super(page);
    this.page = page;
  }

  async gotoClasses() {
    await this.goToNavItem('Classes');
  }

  async gotoStaff() {
    await this.goToNavItem('Staff');
  }

  async gotoFinance() {
    await this.goToNavItem('Fee collection');
  }

  /**
   * Classes list -> click a class card (opens its roster) -> "Enroll Student".
   * Class cards are plain onClick <div>s (not links/buttons), keyed by class name.
   */
  async gotoStudentEnrollment(className) {
    await this.goToNavItem('Classes');
    await this.page.getByText(className, { exact: false }).first().click();
    await this.page.getByRole('button', { name: /enroll student/i }).click();
  }

  // ---- Student enrollment form (pages/StudentEnrollmentForm.jsx) -----------
  // Step 1 fields use real <label htmlFor> except Date of Birth/Admission Date,
  // whose <label> isn't wired to the input's id — target those by id instead.

  async fillEnrollmentField(label, value) {
    await this.page.getByLabel(label, { exact: false }).fill(value);
  }

  async fillDateOfBirth(value) {
    await this.page.locator('#dob').fill(value);
  }

  async goToNextEnrollmentStep() {
    await this.page.getByRole('button', { name: /next step/i }).click();
  }

  async submitEnrollmentForm() {
    await this.page.getByRole('button', { name: /^submit$/i }).click();
  }

  formErrorSummary() {
    return this.page.getByRole('alert');
  }

  // ---- Announcements (pages/AnnouncementsPage.jsx) --------------------------

  async gotoAnnouncements() {
    await this.goToNavItem('Announcements');
  }

  async createAnnouncement(title) {
    await this.page.getByRole('button', { name: /create announcement/i }).click();
    await this.page.getByLabel(/subject/i).fill(title ?? '');
    await this.page.getByRole('dialog').getByRole('button', { name: /^publish$/i }).click();
    // Publishing raises its own confirmation dialog with a second "Publish" button.
    const confirmDialog = this.page.getByRole('dialog').filter({ hasText: /publish this announcement/i });
    if (await confirmDialog.isVisible().catch(() => false)) {
      await confirmDialog.getByRole('button', { name: /^publish$/i }).click();
    }
  }
}
