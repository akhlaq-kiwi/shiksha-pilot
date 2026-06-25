# SaaS School Management Platform Requirements

## Overview

A cloud-native, multi-tenant School ERP platform where each school operates in its own isolated workspace. The platform uses predefined system roles (hard-coded) instead of configurable RBAC, keeping the application simple, secure, and easy to maintain.

---

# 1. SaaS Platform (Super Admin)

## Objective

Manage schools, subscriptions, platform security, and tenant lifecycle.

---

## 1.1 School Management

**Requirement**

Create and manage schools as isolated tenants.

### Features

* Create School
* Edit School
* Activate / Suspend School
* Delete School
* School Branding
* Custom Domain (Optional)
* Tenant Isolation

---

## 1.2 Subscription Management

**Requirement**

Manage subscription plans and billing for each school.

### Features

* Free Trial
* Monthly / Yearly Plans
* Subscription Status
* Plan Upgrade / Downgrade
* Invoice Generation
* Payment History

---

## 1.3 System Users

**Requirement**

Manage platform users using predefined system roles.

### Hard-Coded Roles

* Super Admin
* Support Admin (Optional)

### Features

* Create Admin
* Disable Admin
* Reset Password
* Manage Access

---

## 1.4 Security

**Requirement**

Track important platform activities.

### Features

* Audit Logs
* Login History

---

# 2. School Admin Portal

## Objective

Allow each school to manage its academic and administrative operations independently.

---

## 2.1 School Profile

**Requirement**

Configure school information and branding.

### Features

* School Information
* Logo
* Contact Details
* Academic Session
* Departments
* Branches

---

## 2.2 Academic Management

**Requirement**

Manage the school's academic structure.

### Features

* Academic Years
* Terms
* Classes
* Sections
* Streams
* Subjects

---

## 2.3 Student Management

**Requirement**

Manage the complete student lifecycle.

### Features

* Admissions
* Student Profiles
* Student Documents
* Class Assignment
* Promotion
* Transfer
* Alumni

---

## 2.4 Staff Management

**Requirement**

Manage teachers and school staff.

### Features

* Staff Profiles
* Departments
* Attendance
* Leave
* Payroll
* Documents

---

## 2.5 Timetable Management

**Requirement**

Create and manage school timetables.

### Features

* Class Timetable
* Teacher Timetable
* Room Allocation
* Substitute Teachers

---

## 2.6 Attendance

**Requirement**

Track student and staff attendance.

### Features

* Student Attendance
* Staff Attendance
* Attendance Reports

---

## 2.7 Examination

**Requirement**

Manage exams, marks, and report cards.

### Features

* Exam Creation
* Marks Entry
* Grade Calculation
* Report Cards
* Result Publishing

---

## 2.8 Finance

**Requirement**

Manage fees and school finances.

### Features

* Fee Structure
* Fee Collection
* Discounts
* Scholarships
* Expenses
* Payroll
* Financial Reports

---

## 2.9 Reports

**Requirement**

Generate operational reports.

### Features

* Student Reports
* Attendance Reports
* Examination Reports
* Financial Reports
* Staff Reports

---

## 2.10 Security

**Requirement**

Track important activities within the school.

### Features

* Audit Logs
* Login History

---

# 3. Teacher Portal

## Objective

Provide teachers with tools to manage classes, attendance, assignments, and examinations.

---

## 3.1 Dashboard

### Features

* Today's Schedule
* Assigned Classes
* Pending Tasks
* Upcoming Exams

---

## 3.2 Classes

### Features

* Student List
* Lesson Plans
* Class Notes

---

## 3.3 Attendance

### Features

* Mark Attendance
* Attendance History

---

## 3.4 Assignments

### Features

* Create Homework
* Assignment Upload
* Evaluate Submissions
* Grade Assignments

---

## 3.5 Examination

### Features

* Marks Entry
* Grade Book
* Student Remarks

---

## 3.6 Learning Materials

### Features

* Upload Notes
* Upload Documents
* Upload Videos

---

# 4. Student & Parent Portal

## Objective

Provide students and parents with visibility into academics, attendance, assignments, examinations, and fee payments.

---

## 4.1 Dashboard

### Features

* Attendance Summary
* Homework
* Upcoming Exams
* Fee Status

---

## 4.2 Academics

### Features

* Timetable
* Subjects
* Results
* Report Cards
* Performance

---

## 4.3 Assignments

### Features

* View Homework
* Submit Assignments
* Assignment History

---

## 4.4 Attendance

### Features

* Daily Attendance
* Monthly Attendance
* Attendance Reports

---

## 4.5 Fees

### Features

* Outstanding Fees
* Online Payment
* Receipts
* Payment History

---

## 4.6 Learning Resources

### Features

* Notes
* Videos
* Study Materials

---

## 4.7 Parent Features

### Features

* Multiple Children
* Attendance Tracking
* Academic Progress
* Fee Tracking
* Leave Requests

---

# Hard-Coded System Roles

* Super Admin
* School Admin
* Teacher
* Student
* Parent

Each role has predefined permissions managed within the application. No custom role or permission configuration is provided, ensuring consistency, simplicity, and reduced maintenance.
