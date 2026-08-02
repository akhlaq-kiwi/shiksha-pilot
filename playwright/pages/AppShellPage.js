/**
 * Common portal chrome shared by every role (frontend/src/layouts/AppLayout.jsx +
 * common/components/AppSidebar.jsx): sidebar nav, global search, logout.
 * Role-specific page objects extend/compose this rather than duplicating it.
 */
export class AppShellPage {
  /** @param {import('@playwright/test').Page} page */
  constructor(page) {
    this.page = page;
    this.sidebarNav = page.getByRole('navigation');
    this.logoutButton = page.getByRole('button', { name: /log ?out/i });
    this.skipLink = page.getByRole('link', { name: /skip to (main )?content/i });
  }

  /**
   * Clicks a sidebar/nav item by its visible label (e.g. "Attendance", "Fee collection").
   * AppSidebar.jsx renders nav items as <button>, not <a>, inside a labelled <nav> per group —
   * scope to the nav region so this doesn't also match unrelated page buttons of the same name.
   */
  async goToNavItem(label) {
    await this.sidebarNav.getByRole('button', { name: label, exact: false }).first().click();
  }

  async openGlobalSearch() {
    await this.page.keyboard.press('Meta+K').catch(() => {});
    await this.page.keyboard.press('Control+K');
  }

  async logout() {
    await this.logoutButton.click();
  }
}
