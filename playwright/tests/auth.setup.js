import { test as setup } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readCsv } from '../utils/csv-reader.js';
import { LoginPage } from '../pages/LoginPage.js';

const AUTH_DIR = path.resolve(fileURLToPath(new URL('.', import.meta.url)), '../.auth');
fs.mkdirSync(AUTH_DIR, { recursive: true });

const ROLE_STORAGE_FILE = {
  SUPER_ADMIN: '.auth/super-admin.json',
  SCHOOL_ADMIN: '.auth/school-admin.json',
  TEACHER: '.auth/teacher.json',
  STUDENT: '.auth/student-parent.json',
  PARENT: '.auth/student-parent.json',
};

const credentials = readCsv('login-credentials.csv');

for (const row of credentials) {
  const password = process.env[row.passwordEnvVar];
  const skip = row.skip === '1' || !row.phone || !password;

  const storagePath = path.join(AUTH_DIR, path.basename(ROLE_STORAGE_FILE[row.role]));

  setup(`authenticate as ${row.role}`, async ({ page }) => {
    if (skip) {
      // No credentials configured for this role — write an empty-but-valid
      // storageState so dependent projects can still load a browser context;
      // specs using it detect the unauthenticated state and skip themselves
      // (see tests/support/require-auth.js).
      if (!fs.existsSync(storagePath)) {
        fs.writeFileSync(storagePath, JSON.stringify({ cookies: [], origins: [] }));
      }
      setup.skip(true, `No phone/${row.passwordEnvVar} configured for ${row.role} — see playwright/.env.example`);
      return;
    }

    const loginPage = new LoginPage(page);
    await loginPage.goto();
    await loginPage.loginAndWaitForRedirect(row.phone, password);
    await page.context().storageState({ path: storagePath });
  });
}
