<?php

namespace App\Domain\Finance\Controllers;

use App\Shared\BaseController;
use App\Domain\Finance\Services\FinanceService;
use Psr\Http\Message\ResponseInterface as Response;
use Psr\Http\Message\ServerRequestInterface as Request;

class FinanceController extends BaseController
{
    public function __construct(
        private FinanceService $financeService
    ) {}

    private function getSchoolId(Request $request): ?int
    {
        if (function_exists('getAuthUser')) {
            $auth = getAuthUser($request);
            if ($auth && isset($auth['school_id'])) {
                return (int)$auth['school_id'];
            }
        }
        return null;
    }

    private function getAuthUserEmail(Request $request): string
    {
        if (function_exists('getAuthUser')) {
            $auth = getAuthUser($request);
            if ($auth) {
                return $auth['email'] ?? $auth['phone'] ?? 'System';
            }
        }
        return 'System';
    }

    // --- Class Fees Configuration ---

    public function getClassFees(Request $request, Response $response): Response
    {
        $schoolId = $this->getSchoolId($request);
        if (!$schoolId) return $this->error($response, 'Unauthorized', 401);

        $params = $request->getQueryParams();
        $classId = (int)($params['class_id'] ?? 0);
        $ayId = (int)($params['academic_year_id'] ?? 0);

        try {
            $data = $this->financeService->getClassFees($schoolId, $classId, $ayId);
            return $this->success($response, $data);
        } catch (\Exception $e) {
            return $this->error($response, $e->getMessage(), 500);
        }
    }

    public function saveClassFees(Request $request, Response $response): Response
    {
        $schoolId = $this->getSchoolId($request);
        if (!$schoolId) return $this->error($response, 'Unauthorized', 401);

        $data = $request->getParsedBody() ?? [];
        $performedBy = $this->getAuthUserEmail($request);

        try {
            $this->financeService->saveClassFees($schoolId, $data, $performedBy);
            return $this->success($response, ['success' => true]);
        } catch (\Exception $e) {
            $code = $e->getCode() ?: 500;
            return $this->error($response, $e->getMessage(), $code);
        }
    }

    // --- Salaries ---

    public function getMonthlySalaries(Request $request, Response $response, array $args): Response
    {
        $schoolId = $this->getSchoolId($request);
        if (!$schoolId) return $this->error($response, 'Unauthorized', 401);

        $month = $args['month'];
        $params = $request->getQueryParams();
        $ayId = (int)($params['academic_year_id'] ?? 0);

        try {
            $data = $this->financeService->getMonthlySalaries($schoolId, $month, $ayId);
            return $this->success($response, $data);
        } catch (\Exception $e) {
            return $this->error($response, $e->getMessage(), 500);
        }
    }

    public function getTeacherSalaryLedger(Request $request, Response $response, array $args): Response
    {
        $schoolId = $this->getSchoolId($request);
        if (!$schoolId) return $this->error($response, 'Unauthorized', 401);

        $teacherId = (int)$args['id'];
        $params = $request->getQueryParams();
        $ayId = (int)($params['academic_year_id'] ?? 0);

        try {
            $data = $this->financeService->getTeacherSalaryLedger($schoolId, $teacherId, $ayId);
            return $this->success($response, $data);
        } catch (\Exception $e) {
            return $this->error($response, $e->getMessage(), 500);
        }
    }

    public function payTeacherSalary(Request $request, Response $response, array $args): Response
    {
        $schoolId = $this->getSchoolId($request);
        if (!$schoolId) return $this->error($response, 'Unauthorized', 401);

        $teacherId = (int)$args['id'];
        $month = $args['month'];
        $params = $request->getQueryParams();
        $ayId = (int)($params['academic_year_id'] ?? 0);
        $performedBy = $this->getAuthUserEmail($request);

        try {
            $this->financeService->payTeacherSalary($schoolId, $teacherId, $month, $ayId, $performedBy);
            return $this->success($response, ['success' => true]);
        } catch (\Exception $e) {
            return $this->error($response, $e->getMessage(), 400);
        }
    }

    // --- Student Fees ---

    public function getStudentFeesLedger(Request $request, Response $response, array $args): Response
    {
        $schoolId = $this->getSchoolId($request);
        if (!$schoolId) return $this->error($response, 'Unauthorized', 401);

        $studentId = (int)$args['id'];
        $params = $request->getQueryParams();
        $ayId = (int)($params['academic_year_id'] ?? 0);

        try {
            $data = $this->financeService->getStudentFeesLedger($schoolId, $studentId, $ayId);
            return $this->success($response, $data);
        } catch (\Exception $e) {
            return $this->error($response, $e->getMessage(), 500);
        }
    }

    public function payTuitionFee(Request $request, Response $response, array $args): Response
    {
        $schoolId = $this->getSchoolId($request);
        if (!$schoolId) return $this->error($response, 'Unauthorized', 401);

        $studentId = (int)$args['id'];
        $month = $args['month'];
        $params = $request->getQueryParams();
        $ayId = (int)($params['academic_year_id'] ?? 0);
        $performedBy = $this->getAuthUserEmail($request);

        try {
            $this->financeService->payTuitionFee($schoolId, $studentId, $month, $ayId, $performedBy);
            return $this->success($response, ['success' => true]);
        } catch (\Exception $e) {
            $code = ($e->getCode() === 404) ? 404 : 400;
            return $this->error($response, $e->getMessage(), $code);
        }
    }

    public function payMultipleFees(Request $request, Response $response, array $args): Response
    {
        $schoolId = $this->getSchoolId($request);
        if (!$schoolId) return $this->error($response, 'Unauthorized', 401);

        $studentId = (int)$args['id'];
        $data = $request->getParsedBody() ?? [];
        $months = $data['months'] ?? [];
        $ayId = (int)($data['academic_year_id'] ?? 0);
        $performedBy = $this->getAuthUserEmail($request);

        try {
            $records = $this->financeService->payMultipleFees($schoolId, $studentId, $months, $ayId, $performedBy);
            return $this->success($response, [
                'success' => true,
                'records' => $records
            ]);
        } catch (\Exception $e) {
            $code = ($e->getCode() === 404) ? 404 : 400;
            return $this->error($response, $e->getMessage(), $code);
        }
    }

    public function revertTuitionFee(Request $request, Response $response, array $args): Response
    {
        $schoolId = $this->getSchoolId($request);
        if (!$schoolId) return $this->error($response, 'Unauthorized', 401);

        $studentId = (int)$args['id'];
        $month = $args['month'];
        $params = $request->getQueryParams();
        $ayId = (int)($params['academic_year_id'] ?? 0);
        $performedBy = $this->getAuthUserEmail($request);

        try {
            $this->financeService->revertTuitionFee($schoolId, $studentId, $month, $ayId, $performedBy);
            return $this->success($response, ['success' => true]);
        } catch (\Exception $e) {
            return $this->error($response, $e->getMessage(), 400);
        }
    }

    // --- Carry Forward Dues ---

    public function getStudentCarryForwardDues(Request $request, Response $response, array $args): Response
    {
        $schoolId = $this->getSchoolId($request);
        if (!$schoolId) return $this->error($response, 'Unauthorized', 401);

        $studentId = (int)$args['id'];

        try {
            $data = $this->financeService->getStudentCarryForwardDues($schoolId, $studentId);
            return $this->success($response, $data);
        } catch (\Exception $e) {
            return $this->error($response, $e->getMessage(), 500);
        }
    }

    public function payCarryForwardDue(Request $request, Response $response, array $args): Response
    {
        $schoolId = $this->getSchoolId($request);
        if (!$schoolId) return $this->error($response, 'Unauthorized', 401);

        $studentId = (int)$args['id'];
        $dueId = (int)$args['due_id'];
        $data = $request->getParsedBody() ?? [];
        $amount = (float)($data['amount'] ?? 0);
        $date = $data['date'] ?? date('Y-m-d');
        $performedBy = $this->getAuthUserEmail($request);

        try {
            $this->financeService->payCarryForwardDue($schoolId, $studentId, $dueId, $amount, $date, $performedBy);
            return $this->success($response, ['success' => true]);
        } catch (\Exception $e) {
            $code = ($e->getCode() === 404) ? 404 : 400;
            return $this->error($response, $e->getMessage(), $code);
        }
    }

    public function revertCarryForwardDueRecovery(Request $request, Response $response, array $args): Response
    {
        $schoolId = $this->getSchoolId($request);
        if (!$schoolId) return $this->error($response, 'Unauthorized', 401);

        $studentId = (int)$args['id'];
        $recoveryId = (int)$args['recovery_id'];
        $performedBy = $this->getAuthUserEmail($request);

        try {
            $this->financeService->revertCarryForwardDueRecovery($schoolId, $studentId, $recoveryId, $performedBy);
            return $this->success($response, ['success' => true]);
        } catch (\Exception $e) {
            $code = ($e->getCode() === 404) ? 404 : 400;
            return $this->error($response, $e->getMessage(), $code);
        }
    }

    public function getFinancePreviousDues(Request $request, Response $response): Response
    {
        $schoolId = $this->getSchoolId($request);
        if (!$schoolId) return $this->error($response, 'Unauthorized', 401);

        $params = $request->getQueryParams();
        $activeYearId = (int)($params['academic_year_id'] ?? 0);

        try {
            $data = $this->financeService->getFinancePreviousDues($schoolId, $activeYearId);
            return $this->success($response, $data);
        } catch (\Exception $e) {
            return $this->error($response, $e->getMessage(), 500);
        }
    }

    public function getFinancePreviousDuesRecoveries(Request $request, Response $response): Response
    {
        $schoolId = $this->getSchoolId($request);
        if (!$schoolId) return $this->error($response, 'Unauthorized', 401);

        $params = $request->getQueryParams();
        $activeYearId = (int)($params['academic_year_id'] ?? 0);

        try {
            $data = $this->financeService->getFinancePreviousDuesRecoveries($schoolId, $activeYearId);
            return $this->success($response, $data);
        } catch (\Exception $e) {
            return $this->error($response, $e->getMessage(), 500);
        }
    }

    // --- Financial Reports ---

    public function getFinancialReportsHistory(Request $request, Response $response): Response
    {
        $schoolId = $this->getSchoolId($request);
        if (!$schoolId) return $this->error($response, 'Unauthorized', 401);

        $params = $request->getQueryParams();
        $ayId = (int)($params['academic_year_id'] ?? 0);

        try {
            $data = $this->financeService->getFinancialReportsHistory($schoolId, $ayId);
            return $this->success($response, $data);
        } catch (\Exception $e) {
            return $this->error($response, $e->getMessage(), 500);
        }
    }

    public function previewFinancialReport(Request $request, Response $response): Response
    {
        $schoolId = $this->getSchoolId($request);
        if (!$schoolId) return $this->error($response, 'Unauthorized', 401);

        $params = $request->getQueryParams();
        $fromDate = $params['from_date'] ?? '';
        $toDate = $params['to_date'] ?? '';
        $ayId = (int)($params['academic_year_id'] ?? 0);

        if (empty($fromDate) || empty($toDate) || !$ayId) {
            return $this->error($response, 'from_date, to_date, and academic_year_id are required.', 400);
        }

        try {
            $data = $this->financeService->previewFinancialReport($schoolId, $fromDate, $toDate, $ayId);
            return $this->success($response, $data);
        } catch (\Exception $e) {
            return $this->error($response, $e->getMessage(), 500);
        }
    }

    public function generateFinancialReport(Request $request, Response $response): Response
    {
        $schoolId = $this->getSchoolId($request);
        if (!$schoolId) return $this->error($response, 'Unauthorized', 401);

        $data = $request->getParsedBody() ?? [];
        $fromDate = $data['from_date'] ?? '';
        $toDate = $data['to_date'] ?? '';
        $ayId = (int)($data['academic_year_id'] ?? 0);
        $performedBy = $this->getAuthUserEmail($request);

        if (empty($fromDate) || empty($toDate) || !$ayId) {
            return $this->error($response, 'from_date, to_date, and academic_year_id are required.', 400);
        }

        try {
            $report = $this->financeService->generateFinancialReport($schoolId, $fromDate, $toDate, $ayId, $performedBy);
            return $this->success($response, $report);
        } catch (\Exception $e) {
            return $this->error($response, $e->getMessage(), 500);
        }
    }

    public function toggleReportSettlement(Request $request, Response $response, array $args): Response
    {
        $schoolId = $this->getSchoolId($request);
        if (!$schoolId) return $this->error($response, 'Unauthorized', 401);

        $reportId = (int)$args['id'];
        $performedBy = $this->getAuthUserEmail($request);

        try {
            $result = $this->financeService->toggleReportSettlement($schoolId, $reportId, $performedBy);
            return $this->success($response, $result);
        } catch (\Exception $e) {
            $code = ($e->getCode() === 404) ? 404 : 500;
            return $this->error($response, $e->getMessage(), $code);
        }
    }

    public function exportFinancialReport(Request $request, Response $response, array $args): Response
    {
        $schoolId = $this->getSchoolId($request);
        if (!$schoolId) return $this->error($response, 'Unauthorized', 401);

        $reportId = (int)$args['id'];
        $performedBy = $this->getAuthUserEmail($request);

        try {
            $resData = $this->financeService->exportFinancialReport($schoolId, $reportId, $performedBy);
            $fileContents = file_get_contents($resData['file_path']);
            @unlink($resData['file_path']);

            $response->getBody()->write($fileContents);
            return $response
                ->withHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
                ->withHeader('Content-Disposition', 'attachment; filename="' . $resData['file_name'] . '"')
                ->withHeader('X-Email-Status', $resData['email_sent'] ? 'Success' : 'Failed')
                ->withHeader('Access-Control-Expose-Headers', 'Content-Disposition, X-Email-Status');
        } catch (\Exception $e) {
            $code = ($e->getCode() === 404) ? 404 : 500;
            return $this->error($response, $e->getMessage(), $code);
        }
    }

    // --- School Expenses ---

    public function getSchoolExpenses(Request $request, Response $response): Response
    {
        $schoolId = $this->getSchoolId($request);
        if (!$schoolId) return $this->error($response, 'Unauthorized', 401);

        $params = $request->getQueryParams();
        $ayId = (int)($params['academic_year_id'] ?? 0);

        try {
            $data = $this->financeService->getSchoolExpenses($schoolId, $ayId);
            return $this->success($response, $data);
        } catch (\Exception $e) {
            return $this->error($response, $e->getMessage(), 500);
        }
    }

    public function addSchoolExpense(Request $request, Response $response): Response
    {
        $schoolId = $this->getSchoolId($request);
        if (!$schoolId) return $this->error($response, 'Unauthorized', 401);

        $data = $request->getParsedBody() ?? [];
        $description = $data['description'] ?? '';
        $amount = (float)($data['amount'] ?? 0);
        $ayId = (int)($data['academic_year_id'] ?? 0);
        $performedBy = $this->getAuthUserEmail($request);

        try {
            $expense = $this->financeService->addSchoolExpense($schoolId, $ayId, $description, $amount, $performedBy);
            return $this->success($response, $expense);
        } catch (\Exception $e) {
            return $this->error($response, $e->getMessage(), 400);
        }
    }

    // --- Extra Fee Types ---

    public function getExtraFeeTypes(Request $request, Response $response): Response
    {
        $schoolId = $this->getSchoolId($request);
        if (!$schoolId) return $this->error($response, 'Unauthorized', 401);

        $params = $request->getQueryParams();
        $ayId = (int)($params['academic_year_id'] ?? 0);

        try {
            $data = $this->financeService->getExtraFeeTypes($schoolId, $ayId);
            return $this->success($response, $data);
        } catch (\Exception $e) {
            return $this->error($response, $e->getMessage(), 500);
        }
    }

    public function addExtraFeeType(Request $request, Response $response): Response
    {
        $schoolId = $this->getSchoolId($request);
        if (!$schoolId) return $this->error($response, 'Unauthorized', 401);

        $data = $request->getParsedBody() ?? [];
        $name = $data['name'] ?? '';
        $amount = (float)($data['amount'] ?? 0);
        $ayId = (int)($data['academic_year_id'] ?? 0);
        $performedBy = $this->getAuthUserEmail($request);

        try {
            $result = $this->financeService->addExtraFeeType($schoolId, $ayId, $name, $amount, $performedBy);
            return $this->success($response, $result);
        } catch (\Exception $e) {
            return $this->error($response, $e->getMessage(), 400);
        }
    }

    public function editExtraFeeType(Request $request, Response $response, array $args): Response
    {
        $schoolId = $this->getSchoolId($request);
        if (!$schoolId) return $this->error($response, 'Unauthorized', 401);

        $typeId = (int)$args['id'];
        $data = $request->getParsedBody() ?? [];
        $name = $data['name'] ?? '';
        $amount = (float)($data['amount'] ?? 0);
        $performedBy = $this->getAuthUserEmail($request);

        try {
            $result = $this->financeService->editExtraFeeType($schoolId, $typeId, $name, $amount, $performedBy);
            return $this->success($response, $result);
        } catch (\Exception $e) {
            $code = ($e->getCode() === 404) ? 404 : 400;
            return $this->error($response, $e->getMessage(), $code);
        }
    }

    public function getStudentExtraFees(Request $request, Response $response): Response
    {
        $schoolId = $this->getSchoolId($request);
        if (!$schoolId) return $this->error($response, 'Unauthorized', 401);

        $params = $request->getQueryParams();
        $ayId = (int)($params['academic_year_id'] ?? 0);

        try {
            $data = $this->financeService->getStudentExtraFees($schoolId, $ayId);
            return $this->success($response, $data);
        } catch (\Exception $e) {
            return $this->error($response, $e->getMessage(), 500);
        }
    }

    public function payExtraStudentFee(Request $request, Response $response, array $args): Response
    {
        $schoolId = $this->getSchoolId($request);
        if (!$schoolId) return $this->error($response, 'Unauthorized', 401);

        $feeId = (int)$args['id'];
        $performedBy = $this->getAuthUserEmail($request);

        try {
            $result = $this->financeService->payExtraStudentFee($schoolId, $feeId, $performedBy);
            return $this->success($response, $result);
        } catch (\Exception $e) {
            $code = ($e->getCode() === 404) ? 404 : 400;
            return $this->error($response, $e->getMessage(), $code);
        }
    }

    public function revertExtraStudentFee(Request $request, Response $response, array $args): Response
    {
        $schoolId = $this->getSchoolId($request);
        if (!$schoolId) return $this->error($response, 'Unauthorized', 401);

        $feeId = (int)$args['id'];
        $performedBy = $this->getAuthUserEmail($request);

        try {
            $result = $this->financeService->revertExtraStudentFee($schoolId, $feeId, $performedBy);
            return $this->success($response, $result);
        } catch (\Exception $e) {
            $code = ($e->getCode() === 404) ? 404 : 400;
            return $this->error($response, $e->getMessage(), $code);
        }
    }

    // --- Payment Promises ---

    public function getPaymentPromises(Request $request, Response $response): Response
    {
        $schoolId = $this->getSchoolId($request);
        if (!$schoolId) return $this->error($response, 'Unauthorized', 401);

        $params = $request->getQueryParams();
        $ayId = (int)($params['academic_year_id'] ?? 0);

        try {
            $data = $this->financeService->getPaymentPromises($schoolId, $ayId);
            return $this->success($response, $data);
        } catch (\Exception $e) {
            return $this->error($response, $e->getMessage(), 500);
        }
    }

    public function addPaymentPromise(Request $request, Response $response): Response
    {
        $schoolId = $this->getSchoolId($request);
        if (!$schoolId) return $this->error($response, 'Unauthorized', 401);

        $data = $request->getParsedBody() ?? [];
        $studentId = (int)($data['student_id'] ?? 0);
        $date = $data['promise_date'] ?? '';
        $description = $data['description'] ?? '';
        $status = $data['status'] ?? 'Pending';
        $ayId = (int)($data['academic_year_id'] ?? 0);
        $performedBy = $this->getAuthUserEmail($request);

        try {
            $result = $this->financeService->addPaymentPromise($schoolId, $ayId, $studentId, $date, $description, $status, $performedBy);
            return $this->success($response, $result);
        } catch (\Exception $e) {
            $code = ($e->getCode() === 404) ? 404 : 400;
            return $this->error($response, $e->getMessage(), $code);
        }
    }

    public function editPaymentPromise(Request $request, Response $response, array $args): Response
    {
        $schoolId = $this->getSchoolId($request);
        if (!$schoolId) return $this->error($response, 'Unauthorized', 401);

        $promiseId = (int)$args['id'];
        $data = $request->getParsedBody() ?? [];
        $studentId = (int)($data['student_id'] ?? 0);
        $date = $data['promise_date'] ?? '';
        $description = $data['description'] ?? '';
        $status = $data['status'] ?? '';
        $performedBy = $this->getAuthUserEmail($request);

        try {
            $result = $this->financeService->editPaymentPromise($schoolId, $promiseId, $studentId, $date, $description, $status, $performedBy);
            return $this->success($response, $result);
        } catch (\Exception $e) {
            $code = ($e->getCode() === 404) ? 404 : 400;
            return $this->error($response, $e->getMessage(), $code);
        }
    }

    public function deletePaymentPromise(Request $request, Response $response, array $args): Response
    {
        $schoolId = $this->getSchoolId($request);
        if (!$schoolId) return $this->error($response, 'Unauthorized', 401);

        $promiseId = (int)$args['id'];
        $performedBy = $this->getAuthUserEmail($request);

        try {
            $this->financeService->deletePaymentPromise($schoolId, $promiseId, $performedBy);
            return $this->success($response, ['status' => 'success']);
        } catch (\Exception $e) {
            $code = ($e->getCode() === 404) ? 404 : 500;
            return $this->error($response, $e->getMessage(), $code);
        }
    }
}
