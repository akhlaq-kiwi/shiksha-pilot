import { AppShellPage } from './AppShellPage.js';

/**
 * Teacher portal (frontend/src/features/teacher/*). Covers the Attendance and
 * Marks & exams flows exercised by tests/teacher/*.spec.js.
 */
export class TeacherPortal extends AppShellPage {
  /** @param {import('@playwright/test').Page} page */
  constructor(page) {
    super(page);
    this.page = page;
  }

  async gotoAttendance() {
    await this.goToNavItem('Attendance');
  }

  async gotoExamination() {
    await this.goToNavItem('Marks & exams');
  }

  // ---- Attendance (features/teacher/pages/AttendancePage.jsx) --------------

  async selectClass(className) {
    await this.page.getByRole('combobox').first().selectOption({ label: className });
  }

  async selectDate(dateString) {
    await this.page.getByLabel(/date/i).fill(dateString);
  }

  async markAllPresent() {
    await this.page.getByRole('button', { name: /all present/i }).click();
  }

  async markAllAbsent() {
    await this.page.getByRole('button', { name: /all absent/i }).click();
  }

  async submitAttendance() {
    await this.page.getByRole('button', { name: /submit/i }).click();
  }

  studentRow(studentName) {
    return this.page.getByRole('row', { name: new RegExp(studentName, 'i') });
  }

  // ---- Examination (features/teacher/pages/ExaminationPage.jsx) ------------

  async enterMarkForStudent(studentName, marks) {
    const row = this.page.getByRole('row', { name: new RegExp(studentName, 'i') });
    await row.getByRole('spinbutton').or(row.getByRole('textbox')).fill(String(marks));
  }

  async submitMarks() {
    await this.page.getByRole('button', { name: /submit/i }).click();
  }

  // ---- Leave (features/teacher/pages/TeacherLeavePage.jsx) ------------------

  async gotoLeave() {
    await this.goToNavItem('My leave');
  }

  async fillLeaveRequest({ leaveType, startDate, endDate, reason }) {
    if (leaveType) await this.page.getByLabel(/leave type/i).selectOption({ label: leaveType });
    if (startDate) await this.page.getByLabel(/start date/i).fill(startDate);
    if (endDate) await this.page.getByLabel(/end date/i).fill(endDate);
    if (reason) await this.page.getByLabel(/reason/i).fill(reason);
  }

  async submitLeaveRequest() {
    await this.page.getByRole('button', { name: /submit application|submit/i }).click();
  }
}
