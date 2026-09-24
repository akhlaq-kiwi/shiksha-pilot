<?php

declare(strict_types=1);

namespace App\Domain\Platform\Controllers;

use App\Shared\BaseController;
use App\Shared\Auth\TokenService;
use App\Shared\Http\RequestParser;
use Psr\Http\Message\ResponseInterface as Response;
use Psr\Http\Message\ServerRequestInterface as Request;
use PDO;

class ReportCardTemplateController extends BaseController
{
    private PDO $db;

    public function __construct(PDO $db, TokenService $tokenService)
    {
        parent::__construct($tokenService);
        $this->db = $db;
    }

    private function ensureBuiltinReportCardTemplates(): void
    {
        try {
            $stmt = $this->db->query("SELECT COUNT(*) FROM report_card_templates WHERE is_system_default = 1");
            $count = $stmt ? (int)$stmt->fetchColumn() : 0;
            if ($stmt) $stmt->closeCursor();

            if ($count < 4) {
                $file025 = __DIR__ . '/../../Database/Migrations/025_ensure_builtin_report_card_templates.sql';
                if (file_exists($file025)) {
                    $sql = file_get_contents($file025);
                    $statements = array_filter(array_map('trim', explode(';', $sql)), fn(string $s) => $s !== '');
                    foreach ($statements as $st) {
                        $this->db->exec($st);
                    }
                }
            }
        } catch (\Throwable $e) {
            // Ignore fallback errors
        }
    }

    /**
     * GET /api/platform/report-card-templates
     * List all available report card templates
     */
    public function listTemplates(Request $request, Response $response): Response
    {
        $actor = $this->authenticate($request);
        $this->requireRole($actor, ['SUPER_ADMIN']);

        $this->ensureBuiltinReportCardTemplates();

        $stmt = $this->db->query("
            SELECT t.*, 
                   (SELECT COUNT(*) FROM schools s WHERE s.report_card_template_id = t.id OR (t.is_system_default = 1 AND s.report_card_template_id IS NULL AND t.id = 1)) as assigned_schools_count
            FROM report_card_templates t
            ORDER BY t.is_system_default DESC, t.name ASC
        ");
        $templates = $stmt->fetchAll(PDO::FETCH_ASSOC);


        foreach ($templates as &$t) {
            $t['layout_config'] = json_decode($t['layout_config'] ?? '{}', true) ?? [];
            $t['is_system_default'] = (bool)$t['is_system_default'];
            $t['assigned_schools_count'] = (int)$t['assigned_schools_count'];
        }

        return $this->success($response, $templates);
    }

    /**
     * GET /api/platform/report-card-templates/{id}/schools
     * List all schools currently assigned to a specific report card template
     */
    public function getAssignedSchools(Request $request, Response $response, array $args): Response
    {
        $actor = $this->authenticate($request);
        $this->requireRole($actor, ['SUPER_ADMIN']);

        $templateId = (int)($args['id'] ?? 0);

        $stmtTpl = $this->db->prepare("SELECT id, name, code, is_system_default FROM report_card_templates WHERE id = ?");
        $stmtTpl->execute([$templateId]);
        $tpl = $stmtTpl->fetch(PDO::FETCH_ASSOC);

        if (!$tpl) {
            return $this->error($response, 'Template not found.', 404);
        }

        $isDefault = (bool)$tpl['is_system_default'];

        if ($isDefault && (int)$tpl['id'] === 1) {
            $stmt = $this->db->prepare("
                SELECT s.id, s.name, s.code, s.city, s.state, s.phone, s.contact_no, s.email, s.status, s.created_at, s.report_card_template_id
                FROM schools s
                WHERE s.report_card_template_id = ? OR s.report_card_template_id IS NULL
                ORDER BY s.name ASC
            ");
            $stmt->execute([$templateId]);
        } else {
            $stmt = $this->db->prepare("
                SELECT s.id, s.name, s.code, s.city, s.state, s.phone, s.contact_no, s.email, s.status, s.created_at, s.report_card_template_id
                FROM schools s
                WHERE s.report_card_template_id = ?
                ORDER BY s.name ASC
            ");
            $stmt->execute([$templateId]);
        }

        $schools = $stmt->fetchAll(PDO::FETCH_ASSOC) ?: [];

        return $this->success($response, [
            'template' => [
                'id' => (int)$tpl['id'],
                'name' => $tpl['name'],
                'code' => $tpl['code'],
                'is_system_default' => $isDefault
            ],
            'schools' => $schools
        ]);
    }

    /**
     * POST /api/platform/report-card-templates
     * Create a new custom template configuration
     */
    public function createTemplate(Request $request, Response $response): Response
    {
        $actor = $this->authenticate($request);
        $this->requireRole($actor, ['SUPER_ADMIN']);

        $data = RequestParser::body($request);

        $name = trim($data['name'] ?? '');
        $code = strtolower(preg_replace('/[^a-zA-Z0-9_]/', '_', $data['code'] ?? ''));
        $description = trim($data['description'] ?? '');
        $layoutConfig = $data['layout_config'] ?? [];

        if (empty($name) || empty($code)) {
            return $this->error($response, 'Template name and unique code are required.', 400);
        }

        // Ensure unique code
        $chk = $this->db->prepare("SELECT id FROM report_card_templates WHERE code = ?");
        $chk->execute([$code]);
        if ($chk->fetch()) {
            $code .= '_' . time();
        }

        $stmt = $this->db->prepare("
            INSERT INTO report_card_templates (name, code, description, layout_config, is_system_default)
            VALUES (?, ?, ?, ?, 0)
        ");
        $stmt->execute([
            $name,
            $code,
            $description,
            json_encode($layoutConfig)
        ]);

        $newId = (int)$this->db->lastInsertId();

        return $this->success($response, [
            'id' => $newId,
            'message' => 'Report card template created successfully.'
        ]);
    }

    /**
     * PUT /api/platform/report-card-templates/{id}
     * Update an existing template configuration
     */
    public function updateTemplate(Request $request, Response $response, array $args): Response
    {
        $actor = $this->authenticate($request);
        $this->requireRole($actor, ['SUPER_ADMIN']);

        $templateId = (int)($args['id'] ?? 0);
        $data = RequestParser::body($request);

        $stmt = $this->db->prepare("SELECT * FROM report_card_templates WHERE id = ?");
        $stmt->execute([$templateId]);
        $existing = $stmt->fetch(PDO::FETCH_ASSOC);

        if (!$existing) {
            return $this->error($response, 'Report card template not found.', 404);
        }

        $name = trim($data['name'] ?? $existing['name']);
        $description = trim($data['description'] ?? $existing['description']);
        $layoutConfig = isset($data['layout_config']) ? json_encode($data['layout_config']) : $existing['layout_config'];

        $upd = $this->db->prepare("
            UPDATE report_card_templates
            SET name = ?, description = ?, layout_config = ?, updated_at = NOW()
            WHERE id = ?
        ");
        $upd->execute([$name, $description, $layoutConfig, $templateId]);

        return $this->success($response, ['message' => 'Report card template updated successfully.']);
    }

    /**
     * DELETE /api/platform/report-card-templates/{id}
     * Delete custom template if unused by any school
     */
    public function deleteTemplate(Request $request, Response $response, array $args): Response
    {
        $actor = $this->authenticate($request);
        $this->requireRole($actor, ['SUPER_ADMIN']);

        $templateId = (int)($args['id'] ?? 0);

        $stmt = $this->db->prepare("SELECT * FROM report_card_templates WHERE id = ?");
        $stmt->execute([$templateId]);
        $existing = $stmt->fetch(PDO::FETCH_ASSOC);

        if (!$existing) {
            return $this->error($response, 'Template not found.', 404);
        }

        if ($existing['is_system_default']) {
            return $this->error($response, 'System default templates cannot be deleted.', 400);
        }

        // Check if assigned to any school
        $chk = $this->db->prepare("SELECT COUNT(*) FROM schools WHERE report_card_template_id = ?");
        $chk->execute([$templateId]);
        if ($chk->fetchColumn() > 0) {
            return $this->error($response, 'Cannot delete template assigned to active schools. Reassign schools first.', 400);
        }

        $del = $this->db->prepare("DELETE FROM report_card_templates WHERE id = ?");
        $del->execute([$templateId]);

        return $this->success($response, ['message' => 'Template deleted successfully.']);
    }

    /**
     * POST /api/platform/schools/{id}/report-card-template
     * Assign a report card template to a school
     */
    public function assignTemplateToSchool(Request $request, Response $response, array $args): Response
    {
        $actor = $this->authenticate($request);
        $this->requireRole($actor, ['SUPER_ADMIN']);

        $this->ensureBuiltinReportCardTemplates();

        $schoolId = (int)($args['id'] ?? 0);

        $data = RequestParser::body($request);
        $templateId = isset($data['template_id']) ? (int)$data['template_id'] : null;

        if ($templateId !== null) {
            $chk = $this->db->prepare("SELECT id FROM report_card_templates WHERE id = ?");
            $chk->execute([$templateId]);
            if (!$chk->fetch()) {
                return $this->error($response, 'Selected template does not exist.', 400);
            }
        }

        $upd = $this->db->prepare("UPDATE schools SET report_card_template_id = ? WHERE id = ?");
        $upd->execute([$templateId, $schoolId]);

        // Find current ACTIVE / current working academic year for this school
        $stmtActiveAy = $this->db->prepare("
            SELECT id FROM academic_years 
            WHERE school_id = :sid AND (status = 'ACTIVE' OR is_current = 1) 
            ORDER BY is_current DESC, id DESC LIMIT 1
        ");
        $stmtActiveAy->execute([':sid' => $schoolId]);
        $activeAyId = (int)($stmtActiveAy->fetchColumn() ?: 0);

        if ($activeAyId > 0) {
            // Update active academic year's report_card_template_id ONLY (archived years stay isolated)
            $updAY = $this->db->prepare("UPDATE academic_years SET report_card_template_id = ? WHERE id = ? AND school_id = ?");
            $updAY->execute([$templateId, $activeAyId, $schoolId]);

            // Reset/clear active academic year exams, papers, marks & seating plans
            try {
                // Delete seating plans for active year exams
                $this->db->prepare("
                    DELETE FROM seating_plans 
                    WHERE exam_id IN (SELECT id FROM examinations WHERE school_id = ? AND academic_year_id = ?)
                ")->execute([$schoolId, $activeAyId]);

                // Delete marks for active year papers
                $this->db->prepare("
                    DELETE FROM exam_marks 
                    WHERE exam_paper_id IN (
                        SELECT ep.id FROM exam_papers ep 
                        JOIN examinations e ON ep.exam_id = e.id 
                        WHERE e.school_id = ? AND e.academic_year_id = ?
                    )
                ")->execute([$schoolId, $activeAyId]);

                // Delete exam papers for active year
                $this->db->prepare("
                    DELETE FROM exam_papers 
                    WHERE exam_id IN (SELECT id FROM examinations WHERE school_id = ? AND academic_year_id = ?)
                ")->execute([$schoolId, $activeAyId]);

                // Delete examinations for active year
                $this->db->prepare("
                    DELETE FROM examinations 
                    WHERE school_id = ? AND academic_year_id = ?
                ")->execute([$schoolId, $activeAyId]);
            } catch (\Throwable $t) {
                // Log/ignore table schema differences if any
            }

            // Auto-seed default exams for newly assigned template if applicable
            try {
                $schoolAdminService = new \App\Domain\SchoolAdmin\Services\SchoolAdminService();
                $schoolAdminService->autoSeedDefaultSessionExams($this->db, $schoolId, $activeAyId);
            } catch (\Throwable $t) {
                // Ignore seeding errors
            }
        }

        return $this->success($response, ['message' => 'Report card template assigned to active academic year successfully. Active year exam data reset for fresh start; archived years remain 100% isolated.']);
    }
}
