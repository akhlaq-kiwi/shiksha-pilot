/**
 * Guards a role-specific spec against running with an empty (unauthenticated)
 * storageState — which happens whenever auth.setup.js had no credentials for
 * that role configured (see playwright/.env.example). Call at the top of a
 * `test()` body after navigating to the portal home; skips the test instead
 * of failing on a redirect-to-/login it can't do anything about.
 *
 * @param {import('@playwright/test').Page} page
 * @param {import('@playwright/test').TestType<any, any>['skip']} skipFn  pass `test.skip`
 */
export async function requireAuthenticated(page, skipFn) {
  // The app's route guard redirects unauthenticated users to /login via
  // client-side routing, which can happen a beat after domcontentloaded —
  // poll briefly rather than checking the URL exactly once.
  await page.waitForURL(/\/login/, { timeout: 3_000 }).catch(() => {});
  if (page.url().includes('/login')) {
    skipFn(true, 'No authenticated session for this role — configure credentials in playwright/.env (see .env.example) and re-run.');
    return;
  }

  // A school-admin/teacher account whose school has no subscription plan
  // assigned gets walled off behind a "Subscription Required" screen instead
  // of the real portal — assign a plan via the super-admin "Manage Schools"
  // page for that school to unblock these specs.
  const subscriptionWall = page.getByText(/subscription required/i);
  if (await subscriptionWall.isVisible().catch(() => false)) {
    skipFn(true, 'This school has no subscription plan assigned — assign one via super-admin > Manage Schools and re-run.');
  }
}
