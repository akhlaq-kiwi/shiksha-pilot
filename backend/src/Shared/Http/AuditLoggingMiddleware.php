<?php

declare(strict_types=1);

namespace App\Shared\Http;

use Psr\Http\Message\ServerRequestInterface as Request;
use Psr\Http\Server\RequestHandlerInterface as Handler;
use Psr\Http\Message\ResponseInterface as Response;
use App\Shared\Auth\TokenService;
use App\Database\Connection;
use App\Domain\SchoolAdmin\Services\SchoolAdminService;
use PDO;

class AuditLoggingMiddleware
{
    public function __construct(
        private readonly TokenService $tokenService,
        private readonly Connection $connection,
        private readonly SchoolAdminService $schoolAdminService
    ) {}

    public function __invoke(Request $request, Handler $handler): Response
    {
        $method = $request->getMethod();
        $path = $request->getUri()->getPath();

        // 1. Performance optimization: Quick exit for GET and OPTIONS
        if ($method === 'GET' || $method === 'OPTIONS') {
            return $handler->handle($request);
        }

        // Decode user
        $user = $this->tokenService->fromRequest($request);
        $schoolId = $user ? (int)($user['school_id'] ?? 0) : 0;
        $pdo = $this->connection->getPdo();

        // 2. Pre-fetch original record for PUT/PATCH/DELETE (and POST revert)
        $preFetched = null;
        if ($user && $schoolId > 0) {
            $isRevertPath = ($method === 'POST' && preg_match('#^/api/school/additional-fees/payments/(\d+)/revert$#', $path));
            if ($method === 'PUT' || $method === 'PATCH' || $method === 'DELETE' || $isRevertPath) {
                if (preg_match('#^/api/school/students/(\d+)$#', $path, $matches)) {
                    $id = (int)$matches[1];
                    $stmt = $pdo->prepare("SELECT s.*, c.name AS class_name, c.section AS class_section FROM students s LEFT JOIN classes c ON s.class_id = c.id WHERE s.id = :id AND s.school_id = :sid LIMIT 1");
                    $stmt->execute([':id' => $id, ':sid' => $schoolId]);
                    $preFetched = $stmt->fetch(PDO::FETCH_ASSOC) ?: null;
                } elseif (preg_match('#^/api/school/staff/(\d+)$#', $path, $matches)) {
                    $id = (int)$matches[1];
                    $stmt = $pdo->prepare("SELECT * FROM staff WHERE id = :id AND school_id = :sid LIMIT 1");
                    $stmt->execute([':id' => $id, ':sid' => $schoolId]);
                    $preFetched = $stmt->fetch(PDO::FETCH_ASSOC) ?: null;
                } elseif (preg_match('#^/api/school/expenses/(\d+)$#', $path, $matches)) {
                    $id = (int)$matches[1];
                    $stmt = $pdo->prepare("SELECT * FROM school_expenses WHERE id = :id AND school_id = :sid LIMIT 1");
                    $stmt->execute([':id' => $id, ':sid' => $schoolId]);
                    $preFetched = $stmt->fetch(PDO::FETCH_ASSOC) ?: null;
                } elseif (preg_match('#^/api/school/additional-fees/types/(\d+)$#', $path, $matches)) {
                    $id = (int)$matches[1];
                    $stmt = $pdo->prepare("SELECT * FROM additional_fee_types WHERE id = :id AND school_id = :sid LIMIT 1");
                    $stmt->execute([':id' => $id, ':sid' => $schoolId]);
                    $preFetched = $stmt->fetch(PDO::FETCH_ASSOC) ?: null;
                } elseif (preg_match('#^/api/school/holidays/(\d+)$#', $path, $matches)) {
                    $id = (int)$matches[1];
                    $stmt = $pdo->prepare("SELECT * FROM holidays WHERE id = :id AND school_id = :sid LIMIT 1");
                    $stmt->execute([':id' => $id, ':sid' => $schoolId]);
                    $preFetched = $stmt->fetch(PDO::FETCH_ASSOC) ?: null;
                } elseif (preg_match('#^/api/school/exams-new/(\d+)$#', $path, $matches)) {
                    $id = (int)$matches[1];
                    $stmt = $pdo->prepare("SELECT * FROM exams_new WHERE id = :id AND school_id = :sid LIMIT 1");
                    $stmt->execute([':id' => $id, ':sid' => $schoolId]);
                    $preFetched = $stmt->fetch(PDO::FETCH_ASSOC) ?: null;
                } elseif (preg_match('#^/api/school/fee-payments/(\d+)$#', $path, $matches)) {
                    $id = (int)$matches[1];
                    $stmt = $pdo->prepare("SELECT fp.*, s.name AS student_name FROM fee_payments fp JOIN students s ON fp.student_id = s.id WHERE fp.id = :id AND fp.school_id = :sid LIMIT 1");
                    $stmt->execute([':id' => $id, ':sid' => $schoolId]);
                    $preFetched = $stmt->fetch(PDO::FETCH_ASSOC) ?: null;
                } elseif (preg_match('#^/api/school/timetable/(\d+)$#', $path, $matches)) {
                    $id = (int)$matches[1];
                    $stmt = $pdo->prepare("SELECT t.*, s.name AS subject_name, c.name AS class_name, c.section AS class_section FROM timetable t JOIN subjects s ON t.subject_id = s.id JOIN classes c ON t.class_id = c.id WHERE t.id = :id AND t.school_id = :sid LIMIT 1");
                    $stmt->execute([':id' => $id, ':sid' => $schoolId]);
                    $preFetched = $stmt->fetch(PDO::FETCH_ASSOC) ?: null;
                } elseif (preg_match('#^/api/school/subjects/(\d+)$#', $path, $matches)) {
                    $id = (int)$matches[1];
                    $stmt = $pdo->prepare("SELECT * FROM subjects WHERE id = :id AND school_id = :sid LIMIT 1");
                    $stmt->execute([':id' => $id, ':sid' => $schoolId]);
                    $preFetched = $stmt->fetch(PDO::FETCH_ASSOC) ?: null;
                } elseif (preg_match('#^/api/school/financial-reports/(\d+)/settlement-request$#', $path, $matches)) {
                    $id = (int)$matches[1];
                    $stmt = $pdo->prepare("SELECT * FROM financial_reports WHERE id = :id AND school_id = :sid LIMIT 1");
                    $stmt->execute([':id' => $id, ':sid' => $schoolId]);
                    $preFetched = $stmt->fetch(PDO::FETCH_ASSOC) ?: null;
                } elseif (preg_match('#^/api/school/additional-fees/payments/(\d+)/revert$#', $path, $matches)) {
                    $id = (int)$matches[1];
                    $stmt = $pdo->prepare("SELECT fp.*, s.name AS student_name FROM additional_fee_payments fp JOIN students s ON fp.student_id = s.id WHERE fp.id = :id AND fp.school_id = :sid LIMIT 1");
                    $stmt->execute([':id' => $id, ':sid' => $schoolId]);
                    $preFetched = $stmt->fetch(PDO::FETCH_ASSOC) ?: null;
                }
            }
        }

        // Run the handler
        $response = $handler->handle($request);

        // Only log successful operations (2xx)
        $status = $response->getStatusCode();
        if ($status < 200 || $status >= 300) {
            return $response;
        }

        // Decoded response data
        $responseData = null;
        try {
            $stream = $response->getBody();
            $stream->rewind();
            $contents = $stream->getContents();
            $stream->rewind();
            $jsonDecoded = json_decode($contents, true);
            if (is_array($jsonDecoded) && isset($jsonDecoded['data'])) {
                $responseData = $jsonDecoded['data'];
            }
        } catch (\Throwable $e) {
            // Ignore format errors
        }

        // Double check token decoding
        if (!$user) {
            $user = $this->tokenService->fromRequest($request);
            if (!$user) {
                return $response;
            }
            $schoolId = (int)($user['school_id'] ?? 0);
        }

        $body = $request->getParsedBody();
        if (!is_array($body)) {
            $body = [];
        }

        $module = '';
        $action = '';
        $desc = '';

        if ($method === 'POST') {
            // --- 1. Classes ---
            if ($path === '/api/school/students') {
                $module = 'Classes';
                $action = 'Student Created';
                $name = trim(($body['first_name'] ?? $responseData['first_name'] ?? '') . ' ' . ($body['last_name'] ?? $responseData['last_name'] ?? ''));
                $className = $body['class_name'] ?? $responseData['class_name'] ?? '';
                $desc = "Student \"{$name}\" enrolled in Class {$className}.";
            } elseif ($path === '/api/school/classes') {
                $module = 'Classes';
                $action = 'Class Created';
                $sections = '';
                if (!empty($body['sections'])) {
                    $secArr = is_array($body['sections']) ? $body['sections'] : explode(',', $body['sections']);
                    $sections = ' - Section ' . implode(', ', array_filter(array_map('trim', $secArr)));
                }
                $desc = "Class \"" . trim($body['name'] ?? '') . "{$sections}\" created.";
            }

            // --- 2. Teachers ---
            elseif ($path === '/api/school/staff') {
                $module = 'Teachers';
                $action = 'Teacher Created';
                $desc = "Teacher \"" . ($body['name'] ?? '') . "\" added to the staff list.";
            } elseif ($path === '/api/school/timetable/backup') {
                $module = 'Teachers';
                $action = 'Backup Teacher Assignment';
                $teacherName = 'Backup Teacher';
                if (!empty($body['backup_teacher_id'])) {
                    $stmt = $pdo->prepare("SELECT name FROM staff WHERE id = :id LIMIT 1");
                    $stmt->execute([':id' => $body['backup_teacher_id']]);
                    $teacherName = $stmt->fetchColumn() ?: 'Backup Teacher';
                }
                $desc = "Backup teacher \"{$teacherName}\" assigned for timetable period on " . ($body['date'] ?? '');
            } elseif ($path === '/api/school/timetable/replace') {
                $module = 'Teachers';
                $action = 'Teacher Assignment';
                $teacherName = 'Teacher';
                if (!empty($body['teacher_id'])) {
                    $stmt = $pdo->prepare("SELECT name FROM staff WHERE id = :id LIMIT 1");
                    $stmt->execute([':id' => $body['teacher_id']]);
                    $teacherName = $stmt->fetchColumn() ?: 'Teacher';
                }
                $desc = "Timetable period main teacher reassigned to \"{$teacherName}\".";
            }

            // --- 3. Fees Portal ---
            elseif ($path === '/api/school/fee-structures') {
                $module = 'Fees Portal';
                $action = 'Fee Structure Creation';
                $desc = "Fee structure \"" . ($body['name'] ?? '') . "\" created.";
            } elseif ($path === '/api/school/class-fee-configurations') {
                $module = 'Fees Portal';
                $action = 'Fee Structure Update';
                $desc = "Class fee configuration saved.";
            } elseif ($path === '/api/school/class-fee-configurations/lock') {
                $module = 'Fees Portal';
                $action = 'Fee Structure Update';
                $desc = "Class fee configuration locked.";
            } elseif ($path === '/api/school/fee-payments') {
                $module = 'Fees Portal';
                $action = 'Fee Collection';

                $studentName = 'Student';
                $studentId = $responseData['student_id'] ?? $body['student_id'] ?? null;
                if ($studentId) {
                    $stmt = $pdo->prepare("SELECT name FROM students WHERE id = :id LIMIT 1");
                    $stmt->execute([':id' => $studentId]);
                    $studentName = $stmt->fetchColumn() ?: 'Student';
                }

                $totalAmount = 0.0;
                $receiptNo = $responseData['receipt_no'] ?? null;
                $isPartial = false;
                if ($receiptNo) {
                    $stmtSum = $pdo->prepare("SELECT SUM(amount_paid) FROM fee_payments WHERE receipt_no = :receipt");
                    $stmtSum->execute([':receipt' => $receiptNo]);
                    $totalAmount = (float)$stmtSum->fetchColumn();

                    $stmtStatus = $pdo->prepare("SELECT COUNT(*) FROM fee_payments WHERE receipt_no = :receipt AND status = 'Partial'");
                    $stmtStatus->execute([':receipt' => $receiptNo]);
                    $isPartial = ((int)$stmtStatus->fetchColumn() > 0);
                } else {
                    $totalAmount = (float)($body['amount_paid'] ?? 0);
                }

                $amountFormatted = number_format($totalAmount);
                if ($isPartial) {
                    $desc = "Partial fee payment of ₹{$amountFormatted} collected from \"{$studentName}\".";
                } else {
                    $desc = "Fee payment of ₹{$amountFormatted} collected from \"{$studentName}\".";
                }
            } elseif ($path === '/api/school/additional-fees/types') {
                $module = 'Fees Portal';
                $action = 'Fee Structure Creation';
                $desc = "Additional fee type \"" . ($body['name'] ?? '') . "\" created.";
            } elseif (preg_match('#^/api/school/additional-fees/payments/(\d+)/pay$#', $path)) {
                $module = 'Fees Portal';
                $action = 'Fee Collection';
                $amountFormatted = '0';
                $studentName = 'Student';
                if ($responseData) {
                    $amountFormatted = number_format((float)($responseData['amount'] ?? 0));
                    $studentName = $responseData['student_name'] ?? 'Student';
                }
                $desc = "Additional fee payment of ₹{$amountFormatted} collected from \"{$studentName}\".";
            } elseif (preg_match('#^/api/school/additional-fees/payments/(\d+)/revert$#', $path)) {
                $module = 'Fees Portal';
                $action = 'Payment Reversal';
                $amountFormatted = '0';
                $studentName = 'Student';
                if ($preFetched) {
                    $amountFormatted = number_format((float)($preFetched['amount'] ?? 0));
                    $studentName = $preFetched['student_name'] ?? 'Student';
                }
                $desc = "Additional fee payment of ₹{$amountFormatted} reverted for \"{$studentName}\".";
            }

            // --- 4. Financial Reports ---
            elseif ($path === '/api/school/financial-reports') {
                $module = 'Financial Reports';
                $action = 'Financial Report Generation';
                $desc = "Financial report generated for " . ($body['from_date'] ?? '') . " – " . ($body['to_date'] ?? '');
            } elseif (preg_match('#^/api/school/financial-reports/(\d+)/settlement-request$#', $path, $matches)) {
                $module = 'Financial Reports';
                $action = 'Report Configuration Update';
                $repId = $preFetched['report_id'] ?? 'Report';
                $desc = "Sent settlement request for report " . $repId;
            }

            // --- 5. Finance Management ---
            elseif ($path === '/api/school/expenses') {
                $module = 'Finance Management';
                $action = 'Expense Entry';
                $expDesc = $responseData['description'] ?? $body['description'] ?? '';
                $expAmt = $responseData['amount'] ?? $body['amount'] ?? 0;
                $expCat = $responseData['category'] ?? $body['category'] ?? 'Other';
                $amount = number_format((float)$expAmt);
                $desc = "Expense of ₹{$amount} recorded for \"{$expDesc}\" under Category: {$expCat}.";
            } elseif ($path === '/api/school/staff-payments') {
                $module = 'Finance Management';
                $action = 'Expense Entry';
                $desc = "Staff salary paid.";
            }

            // --- 6. Audits & Settings ---
            elseif ($path === '/api/school/profile') {
                if (array_key_exists('report_card_remark', $body)) {
                    $module = 'Audits & Settings';
                    $action = 'Remark Configuration Update';
                    $desc = "Report card remark configurations updated.";
                } else {
                    $module = 'Audits & Settings';
                    $action = 'School Profile Update';
                    $desc = "School profile details updated for " . ($body['name'] ?? '');
                }
            } elseif ($path === '/api/school/profile/logo') {
                $module = 'Audits & Settings';
                $action = 'School Profile Update';
                $desc = "School logo uploaded/updated.";
            } elseif ($path === '/api/school/grade-configurations') {
                $module = 'Audits & Settings';
                $action = 'Grade Configuration Update';
                $desc = "Grade scale updated.";
            } elseif ($path === '/api/school/holidays') {
                $module = 'Audits & Settings';
                $action = 'Grade Configuration Update';
                $desc = "Holiday \"" . ($body['name'] ?? '') . "\" created for " . ($body['date'] ?? '');
            } elseif ($path === '/api/school/subjects') {
                $module = 'Audits & Settings';
                $action = 'Grade Configuration Update';
                $desc = "Subject \"" . ($body['name'] ?? '') . "\" created.";
            }

            // --- 7. Academic Year Management ---
            elseif ($path === '/api/school/academic-years') {
                $module = 'Academic Year Management';
                $action = 'Academic Year Creation';
                $desc = "Academic Year session \"" . ($body['name'] ?? '') . "\" created.";
            } elseif (preg_match('#^/api/school/academic-years/(\d+)/activate$#', $path, $matches)) {
                $module = 'Academic Year Management';
                $action = 'Academic Year Activation';
                $ayId = (int)$matches[1];
                $stmt = $pdo->prepare("SELECT name FROM academic_years WHERE id = :id LIMIT 1");
                $stmt->execute([':id' => $ayId]);
                $ayName = $stmt->fetchColumn() ?: 'Academic Year';
                $desc = "Academic Year {$ayName} activated.";
            } elseif (preg_match('#^/api/school/academic-years/(\d+)/migrate$#', $path)) {
                $module = 'Academic Year Management';
                $action = 'Academic Year Migration';
                $desc = "Students promoted/migrated to new Academic Year.";
            }

            // --- 8. Examinations ---
            elseif ($path === '/api/school/exams-new') {
                $module = 'Examinations';
                $action = 'Exam Creation';
                $desc = "Exam \"" . ($body['name'] ?? '') . "\" created.";
            } elseif (preg_match('#^/api/school/exams-new/(\d+)/timetable$#', $path)) {
                $module = 'Examinations';
                $action = 'Timetable Configuration Update';
                $desc = "Examination papers scheduled/updated for timetable.";
            } elseif (preg_match('#^/api/school/exams-new/(\d+)/marks$#', $path)) {
                $module = 'Examinations';
                $action = 'Subject Marks Entry';
                $desc = "Examination marks entered/updated.";
            } elseif (preg_match('#^/api/school/exams-new/(\d+)/publish$#', $path)) {
                $module = 'Examinations';
                $statusVal = $body['status'] ?? 'Published';
                $action = $statusVal === 'Draft' ? 'Result Unpublish' : 'Result Publish';
                $desc = $statusVal === 'Draft' 
                    ? "Results unpublished for Class ID " . ($body['class_id'] ?? '')
                    : "Results published for Class ID " . ($body['class_id'] ?? '');
            } elseif (preg_match('#^/api/school/exams-new/(\d+)/instructions$#', $path)) {
                $module = 'Examinations';
                $action = 'Remark Configuration Update';
                $desc = "Examination timetable instructions updated.";
            }

            // --- 9. Timetable ---
            elseif ($path === '/api/school/timetable') {
                $module = 'Timetable';
                $action = 'Period Assignment';
                $desc = "Subject period added to timetable.";
            } elseif ($path === '/api/school/timetable/publish') {
                $module = 'Timetable';
                $action = 'Timetable Publish';
                $desc = "Timetable published for Class ID " . ($body['class_id'] ?? '');
            } elseif ($path === '/api/school/timetable/paste') {
                $module = 'Timetable';
                $action = 'Timetable Update';
                $desc = "Timetable schedule copied and pasted.";
            } elseif ($path === '/api/school/timetable-settings') {
                if (!empty($body['clear_timetable'])) {
                    $module = 'Timetable';
                    $action = 'Timetable Reset';
                    $desc = "Timetable reset and all periods deleted.";
                } else {
                    $module = 'Timetable';
                    $action = 'Timetable Creation';
                    $desc = "Timetable configuration updated.";
                }
            }

            // --- 10. Attendance ---
            elseif ($path === '/api/school/attendance' || $path === '/api/teacher/attendance') {
                $module = 'Attendance';
                $action = 'Attendance Marked';
                $studentName = 'Student';
                if (!empty($body['student_id'])) {
                    $stmt = $pdo->prepare("SELECT name FROM students WHERE id = :id LIMIT 1");
                    $stmt->execute([':id' => $body['student_id']]);
                    $studentName = $stmt->fetchColumn() ?: 'Student';
                }
                $statusVal = $body['status'] ?? 'Present';
                $dateVal = $body['date'] ?? date('Y-m-d');
                $desc = "Attendance marked as {$statusVal} for {$studentName} on {$dateVal}.";
            }
        } elseif ($method === 'PUT' || $method === 'PATCH') {
            if ($preFetched) {
                // --- 1. Classes ---
                if (preg_match('#^/api/school/students/(\d+)$#', $path)) {
                    $module = 'Classes';
                    $name = trim(($body['first_name'] ?? $preFetched['first_name'] ?? '') . ' ' . ($body['last_name'] ?? $preFetched['last_name'] ?? ''));
                    $oldStatus = $preFetched['status'] ?? '';
                    $newExitDate = !empty($body['exit_date']) ? $body['exit_date'] : null;
                    $newStatus = $newExitDate !== null ? 'Inactive' : ($body['status'] ?? 'ACTIVE');

                    if ($oldStatus !== $newStatus) {
                        $action = 'Student Status Change';
                        if ($newStatus === 'Archived') {
                            $action = 'Student Archive';
                            $desc = "Student \"{$name}\" archived.";
                        } elseif ($oldStatus === 'Archived' && $newStatus === 'ACTIVE') {
                            $action = 'Student Restore';
                            $desc = "Student \"{$name}\" restored.";
                        } else {
                            $desc = "Student \"{$name}\" status changed to {$newStatus}.";
                        }
                    } else {
                        $action = 'Student Update';
                        $desc = "Student \"{$name}\" profile updated.";
                    }
                } elseif ($path === '/api/school/classes') {
                    $module = 'Classes';
                    $action = 'Update Class';
                    $desc = "Class \"" . ($body['oldName'] ?? '') . "\" updated to \"" . ($body['name'] ?? '') . "\".";
                }

                // --- 2. Teachers ---
                elseif (preg_match('#^/api/school/staff/(\d+)$#', $path)) {
                    $module = 'Teachers';
                    $name = $body['name'] ?? $preFetched['name'] ?? '';
                    $oldStatus = $preFetched['status'] ?? '';
                    $newExitDate = !empty($body['exit_date']) ? $body['exit_date'] : null;
                    $newStatus = $newExitDate !== null ? 'Inactive' : ($body['status'] ?? 'ACTIVE');

                    if ($oldStatus !== $newStatus) {
                        $action = 'Teacher Status Change';
                        if ($newStatus === 'Inactive') {
                            $action = 'Teacher Deactivation';
                            $desc = "Teacher \"{$name}\" deactivated.";
                        } else {
                            $action = 'Teacher Reactivation';
                            $desc = "Teacher \"{$name}\" reactivated.";
                        }
                    } else {
                        $action = 'Teacher Update';
                        $desc = "Teacher \"{$name}\" profile updated.";
                    }
                }

                // --- 3. Fees Portal ---
                elseif (preg_match('#^/api/school/additional-fees/types/(\d+)$#', $path)) {
                    $module = 'Fees Portal';
                    $action = 'Fee Structure Update';
                    $desc = "Additional fee type \"" . ($body['name'] ?? $preFetched['name'] ?? '') . "\" updated.";
                }

                // --- 5. Finance Management ---
                elseif (preg_match('#^/api/school/expenses/(\d+)$#', $path)) {
                    $module = 'Finance Management';
                    $action = 'Expense Update';
                    $expDesc = $responseData['description'] ?? $body['description'] ?? $preFetched['description'] ?? '';
                    $expAmt = $responseData['amount'] ?? $body['amount'] ?? $preFetched['amount'] ?? 0;
                    $expCat = $responseData['category'] ?? $body['category'] ?? $preFetched['category'] ?? 'Other';
                    $amount = number_format((float)$expAmt);
                    $desc = "Expense of ₹{$amount} updated for \"{$expDesc}\" under Category: {$expCat}.";
                }

                // --- 6. Audits & Settings ---
                elseif (preg_match('#^/api/school/holidays/(\d+)$#', $path)) {
                    $module = 'Audits & Settings';
                    $action = 'Grade Configuration Update';
                    $desc = "Holiday \"" . ($body['name'] ?? $preFetched['name'] ?? '') . "\" updated.";
                } elseif (preg_match('#^/api/school/subjects/(\d+)$#', $path)) {
                    $module = 'Audits & Settings';
                    $action = 'Grade Configuration Update';
                    $desc = "Subject \"" . ($body['name'] ?? $preFetched['name'] ?? '') . "\" updated.";
                }

                // --- 8. Examinations ---
                elseif (preg_match('#^/api/school/exams-new/(\d+)$#', $path)) {
                    $module = 'Examinations';
                    $action = 'Exam Update';
                    $desc = "Exam \"" . ($body['name'] ?? $preFetched['name'] ?? '') . "\" updated.";
                }
            }
        } elseif ($method === 'DELETE') {
            if ($preFetched) {
                // --- 1. Classes ---
                if (preg_match('#^/api/school/students/(\d+)$#', $path)) {
                    $module = 'Classes';
                    $action = 'Student Delete';
                    $name = trim(($preFetched['first_name'] ?? '') . ' ' . ($preFetched['last_name'] ?? ''));
                    $desc = "Student \"{$name}\" deleted.";
                }

                // --- 2. Teachers ---
                elseif (preg_match('#^/api/school/staff/(\d+)$#', $path)) {
                    $module = 'Teachers';
                    $action = 'Teacher Delete';
                    $name = $preFetched['name'] ?? '';
                    $desc = "Teacher \"{$name}\" deleted.";
                }

                // --- 3. Fees Portal ---
                elseif (preg_match('#^/api/school/fee-payments/(\d+)$#', $path)) {
                    $module = 'Fees Portal';
                    $action = 'Payment Reversal';
                    $amount = number_format((float)($preFetched['amount_paid'] ?? 0));
                    $studentName = $preFetched['student_name'] ?? 'Student';
                    $desc = "Fee payment of ₹{$amount} reverted for \"{$studentName}\".";
                } elseif (preg_match('#^/api/school/additional-fees/types/(\d+)$#', $path)) {
                    $module = 'Fees Portal';
                    $action = 'Fee Structure Delete';
                    $desc = "Additional fee type \"" . ($preFetched['name'] ?? '') . "\" deleted.";
                }

                // --- 5. Finance Management ---
                elseif (preg_match('#^/api/school/expenses/(\d+)$#', $path)) {
                    $module = 'Finance Management';
                    $action = 'Expense Delete';
                    $amount = number_format((float)($preFetched['amount'] ?? 0));
                    $desc = "Expense of ₹{$amount} for \"" . ($preFetched['description'] ?? '') . "\" deleted.";
                } elseif (preg_match('#^/api/school/staff-payments/(\d+)$#', $path)) {
                    $module = 'Finance Management';
                    $action = 'Expense Update';
                    $desc = "Staff salary payment reverted.";
                }

                // --- 6. Audits & Settings ---
                elseif (preg_match('#^/api/school/profile/logo$#', $path)) {
                    $module = 'Audits & Settings';
                    $action = 'School Profile Update';
                    $desc = "School logo removed.";
                } elseif (preg_match('#^/api/school/holidays/(\d+)$#', $path)) {
                    $module = 'Audits & Settings';
                    $action = 'Grade Configuration Update';
                    $desc = "Holiday \"" . ($preFetched['name'] ?? '') . "\" deleted.";
                } elseif (preg_match('#^/api/school/subjects/(\d+)$#', $path)) {
                    $module = 'Audits & Settings';
                    $action = 'Grade Configuration Update';
                    $desc = "Subject \"" . ($preFetched['name'] ?? '') . "\" deleted.";
                }

                // --- 8. Examinations ---
                elseif (preg_match('#^/api/school/exams-new/(\d+)$#', $path)) {
                    $module = 'Examinations';
                    $action = 'Exam Delete';
                    $desc = "Exam \"" . ($preFetched['name'] ?? '') . "\" deleted.";
                }

                // --- 9. Timetable ---
                elseif (preg_match('#^/api/school/timetable/(\d+)$#', $path)) {
                    $module = 'Timetable';
                    $action = 'Period Removal';
                    $subj = $preFetched['subject_name'] ?? 'Subject';
                    $cls = ($preFetched['class_name'] ?? '') . ($preFetched['class_section'] ? ' - ' . $preFetched['class_section'] : '');
                    $desc = "Subject period \"{$subj}\" removed from {$cls} timetable.";
                }
            }
        }

        if ($module !== '' && $action !== '') {
            $workingYear = $this->schoolAdminService->getWorkingAcademicYear($pdo, $schoolId);
            $ayName = $workingYear ? $workingYear['name'] : null;
            $this->schoolAdminService->logAudit($pdo, $user, $module, $action, $desc, $ayName);
        }

        return $response;
    }
}
