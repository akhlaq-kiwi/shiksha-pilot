/**
 * Page Object for the shared /login screen (frontend/src/features/auth/components/LoginForm.jsx).
 * Login is by mobile phone number + password; role is server-determined, not selected on this form.
 */
export class LoginPage {
  /** @param {import('@playwright/test').Page} page */
  constructor(page) {
    this.page = page;
    this.phoneInput = page.getByTestId('login-phone-input');
    this.passwordInput = page.getByTestId('login-password-input');
    this.submitButton = page.getByTestId('login-submit-button');
    this.phoneError = page.getByTestId('login-phone-error');
    this.passwordError = page.getByTestId('login-password-error');
  }

  async goto() {
    await this.page.goto('/login');
  }

  async login(phone, password) {
    await this.phoneInput.fill(phone);
    await this.passwordInput.fill(password);
    await this.submitButton.click();
  }

  /** Logs in and waits for redirect off /login (i.e. successful auth + role routing). */
  async loginAndWaitForRedirect(phone, password) {
    await this.login(phone, password);
    await this.page.waitForURL((url) => !url.pathname.startsWith('/login'), { timeout: 15_000 });
  }
}
