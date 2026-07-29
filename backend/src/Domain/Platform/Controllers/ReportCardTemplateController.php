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

    /**
     * GET /api/platform/report-card-templates
     * List all available report card templates
     */
    public function listTemplates(Request $request, Response $response): Response
    {
        $actor = $this->authenticate($request);
        $this->requireRole($actor, ['SUPER_ADMIN']);

        $stmt = $this->db->query("
            SELECT t.*, 
                   (SELECT COUNT(*) FROM schools s WHERE s.report_card_template_id = t.id) as assigned_schools_count
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

        return $this->success($response, ['message' => 'Report card template assigned to school successfully.']);
    }
}
