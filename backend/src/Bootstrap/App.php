<?php

declare(strict_types=1);

namespace App\Bootstrap;

use DI\ContainerBuilder;
use Slim\App as SlimApp;
use Slim\Factory\AppFactory;
use Psr\Http\Message\ResponseFactoryInterface;

// ── Domain: Auth ──────────────────────────────────────────────────────────────
use App\Database\Connection;
use App\Shared\Auth\TokenService;
use App\Domain\Auth\Repositories\AuthRepository;
use App\Domain\Auth\Services\AuthService;
use App\Domain\Auth\Controllers\AuthController;

// ── Domain: Platform ─────────────────────────────────────────────────────────
use App\Domain\Platform\Repositories\SchoolRepository;
use App\Domain\Platform\Repositories\AuditLogRepository;
use App\Domain\Platform\Repositories\PlansRepository;
use App\Domain\Platform\Repositories\WebsiteLeadRepository;
use App\Domain\Platform\Services\PlatformService;
use App\Domain\Platform\Controllers\PlatformController;
use App\Domain\Platform\Controllers\ReportCardTemplateController;

// ── Domain: SchoolAdmin ───────────────────────────────────────────────────────
use App\Domain\SchoolAdmin\Repositories\StudentRepository;
use App\Domain\SchoolAdmin\Repositories\StaffRepository;
use App\Domain\SchoolAdmin\Repositories\ClassRepository;
use App\Domain\SchoolAdmin\Repositories\AttendanceRepository;
use App\Domain\SchoolAdmin\Repositories\ExamRepository;
use App\Domain\SchoolAdmin\Repositories\FeeRepository;
use App\Domain\SchoolAdmin\Repositories\FinancialReportRepository;
use App\Domain\SchoolAdmin\Repositories\LeaveRequestRepository;
use App\Domain\SchoolAdmin\Services\LeaveRequestService;
use App\Domain\SchoolAdmin\Controllers\LeaveRequestController;
use App\Domain\SchoolAdmin\Services\SchoolAdminService;
use App\Domain\SchoolAdmin\Controllers\SchoolAdminController;

// ── Domain: Teacher ───────────────────────────────────────────────────────────
use App\Domain\Teacher\Repositories\TeacherRepository;
use App\Domain\Teacher\Repositories\AssignmentRepository;
use App\Domain\Teacher\Repositories\MaterialRepository;
use App\Domain\Teacher\Services\TeacherService;
use App\Domain\Teacher\Controllers\TeacherController;
use App\Domain\Teacher\Services\HomeworkService;
use App\Domain\Teacher\Controllers\HomeworkController;

// ── Domain: Student ───────────────────────────────────────────────────────────
use App\Domain\Student\Repositories\StudentDataRepository;
use App\Domain\Student\Services\StudentService;
use App\Domain\Student\Controllers\StudentController;
use App\Domain\Student\Services\VocabularyService;
use App\Domain\Student\Controllers\VocabularyController;

// ── Shared: Push notifications ────────────────────────────────────────────────
use App\Shared\Notifications\FcmClient;
use App\Shared\Notifications\PushDispatcher;
use App\Shared\Notifications\DeviceTokenService;
use App\Shared\Notifications\DeviceTokenController;

/**
 * Load a .env file if it exists, exporting each KEY=VALUE pair via putenv().
 * Lines starting with '#' and empty lines are ignored.
 * Already-set env vars (e.g. from Docker) are NOT overwritten.
 */
function loadEnvFile(string $path): void
{
    if (!is_file($path)) {
        return;
    }

    $lines = file($path, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);

    foreach ($lines as $line) {
        $line = trim($line);

        // Skip comments
        if ($line === '' || $line[0] === '#') {
            continue;
        }

        // Split on first '=' only
        $eqPos = strpos($line, '=');
        if ($eqPos === false) {
            continue;
        }

        $key   = trim(substr($line, 0, $eqPos));
        $value = trim(substr($line, $eqPos + 1));

        // Strip surrounding quotes (single or double)
        if (strlen($value) >= 2
            && (($value[0] === '"' && $value[-1] === '"')
                || ($value[0] === "'" && $value[-1] === "'"))
        ) {
            $value = substr($value, 1, -1);
        }

        // Do not override values already present in the environment
        if (getenv($key) === false) {
            putenv("{$key}={$value}");
            $_ENV[$key]    = $value;
            $_SERVER[$key] = $value;
        }
    }
}

class App
{
    public static function create(): SlimApp
    {
        date_default_timezone_set('Asia/Kolkata');
        // ── 1. Load .env for local development ───────────────────────────────
        loadEnvFile(dirname(__DIR__, 2) . '/.env');

        // ── 2. Build the PHP-DI container ────────────────────────────────────
        $containerBuilder = new ContainerBuilder();

        $containerBuilder->addDefinitions([

            // ── Settings ─────────────────────────────────────────────────────
            'settings' => [
                'displayErrorDetails' => (bool) (getenv('APP_DEBUG') ?: true),
                'db' => [
                    'host'   => getenv('DB_HOST')  ?: 'db',
                    'port'   => getenv('DB_PORT')  ?: '3306',
                    'dbname' => getenv('DB_NAME')  ?: 'shiksha_pilot',
                    'user'   => getenv('DB_USER')  ?: 'root',
                    'pass'   => getenv('DB_PASS')  ?: 'admin123',
                ],
            ],

            // ── Database connection ───────────────────────────────────────────
            Connection::class => function ($c) {
                $db = $c->get('settings')['db'];
                return new Connection($db['host'], $db['dbname'], $db['user'], $db['pass']);
            },

            // ── Shared ────────────────────────────────────────────────────────
            TokenService::class => fn($c) => new TokenService($c->get(Connection::class)),
            \App\Shared\Http\AuditLoggingMiddleware::class => function ($c) {
                return new \App\Shared\Http\AuditLoggingMiddleware(
                    $c->get(TokenService::class),
                    $c->get(Connection::class),
                    $c->get(SchoolAdminService::class)
                );
            },

            // ── Auth ──────────────────────────────────────────────────────────
            AuthRepository::class => function ($c) {
                return new AuthRepository($c->get(Connection::class)->getPdo());
            },

            AuthService::class => function ($c) {
                return new AuthService(
                    $c->get(AuthRepository::class),
                    $c->get(TokenService::class),
                );
            },

            AuthController::class => function ($c) {
                return new AuthController(
                    $c->get(AuthService::class),
                    $c->get(TokenService::class),
                );
            },

            // ── Platform ──────────────────────────────────────────────────────
            SchoolRepository::class => function ($c) {
                return new SchoolRepository($c->get(Connection::class)->getPdo());
            },

            AuditLogRepository::class => function ($c) {
                return new AuditLogRepository($c->get(Connection::class)->getPdo());
            },

            PlansRepository::class => function ($c) {
                return new PlansRepository($c->get(Connection::class)->getPdo());
            },

            WebsiteLeadRepository::class => function ($c) {
                return new WebsiteLeadRepository($c->get(Connection::class)->getPdo());
            },

            PlatformService::class => function ($c) {
                return new PlatformService(
                    $c->get(SchoolRepository::class),
                    $c->get(AuditLogRepository::class),
                    $c->get(AuthRepository::class),
                    $c->get(PlansRepository::class),
                    $c->get(WebsiteLeadRepository::class),
                );
            },

            PlatformController::class => function ($c) {
                return new PlatformController(
                    $c->get(PlatformService::class),
                    $c->get(TokenService::class),
                );
            },

            ReportCardTemplateController::class => function ($c) {
                return new ReportCardTemplateController(
                    $c->get(Connection::class)->getPdo(),
                    $c->get(TokenService::class),
                );
            },

            // ── SchoolAdmin ───────────────────────────────────────────────────
            StudentRepository::class => function ($c) {
                return new StudentRepository($c->get(Connection::class)->getPdo());
            },

            StaffRepository::class => function ($c) {
                return new StaffRepository($c->get(Connection::class)->getPdo());
            },

            ClassRepository::class => function ($c) {
                return new ClassRepository($c->get(Connection::class)->getPdo());
            },

            AttendanceRepository::class => function ($c) {
                return new AttendanceRepository($c->get(Connection::class)->getPdo());
            },

            ExamRepository::class => function ($c) {
                return new ExamRepository($c->get(Connection::class)->getPdo());
            },

            FeeRepository::class => function ($c) {
                return new FeeRepository($c->get(Connection::class)->getPdo());
            },

            FinancialReportRepository::class => function ($c) {
                return new FinancialReportRepository($c->get(Connection::class)->getPdo());
            },

            SchoolAdminService::class => function ($c) {
                return new SchoolAdminService(
                    $c->get(StudentRepository::class),
                    $c->get(StaffRepository::class),
                    $c->get(ClassRepository::class),
                    $c->get(AttendanceRepository::class),
                    $c->get(ExamRepository::class),
                    $c->get(FeeRepository::class),
                    $c->get(FinancialReportRepository::class),
                );
            },

            SchoolAdminController::class => function ($c) {
                return new SchoolAdminController(
                    $c->get(TokenService::class),
                    $c->get(SchoolAdminService::class),
                );
            },

            LeaveRequestRepository::class => function ($c) {
                return new LeaveRequestRepository($c->get(Connection::class)->getPdo());
            },

            LeaveRequestService::class => function ($c) {
                return new LeaveRequestService(
                    $c->get(LeaveRequestRepository::class),
                    $c->get(SchoolAdminService::class),
                    $c->get(AttendanceRepository::class),
                );
            },

            LeaveRequestController::class => function ($c) {
                return new LeaveRequestController(
                    $c->get(TokenService::class),
                    $c->get(LeaveRequestService::class),
                    $c->get(SchoolAdminService::class),
                );
            },

            // ── Teacher ───────────────────────────────────────────────────────
            TeacherRepository::class => function ($c) {
                return new TeacherRepository($c->get(Connection::class)->getPdo());
            },

            AssignmentRepository::class => function ($c) {
                return new AssignmentRepository($c->get(Connection::class)->getPdo());
            },

            MaterialRepository::class => function ($c) {
                return new MaterialRepository($c->get(Connection::class)->getPdo());
            },

            TeacherService::class => function ($c) {
                return new TeacherService(
                    $c->get(TeacherRepository::class),
                    $c->get(AssignmentRepository::class),
                    $c->get(MaterialRepository::class),
                    $c->get(AttendanceRepository::class),
                    $c->get(ExamRepository::class),
                );
            },

            TeacherController::class => function ($c) {
                return new TeacherController(
                    $c->get(TokenService::class),
                    $c->get(TeacherService::class),
                );
            },

            // ── Student / Parent ──────────────────────────────────────────────
            StudentDataRepository::class => function ($c) {
                return new StudentDataRepository($c->get(Connection::class)->getPdo());
            },

            StudentService::class => function ($c) {
                return new StudentService($c->get(StudentDataRepository::class));
            },

            StudentController::class => function ($c) {
                return new StudentController(
                    $c->get(TokenService::class),
                    $c->get(StudentService::class),
                );
            },

            VocabularyService::class => function ($c) {
                return new VocabularyService(
                    $c->get(StudentDataRepository::class),
                );
            },

            VocabularyController::class => function ($c) {
                return new VocabularyController(
                    $c->get(TokenService::class),
                    $c->get(VocabularyService::class),
                );
            },

            HomeworkService::class => function ($c) {
                return new HomeworkService($c->get(Connection::class)->getPdo());
            },

            HomeworkController::class => function ($c) {
                return new HomeworkController(
                    $c->get(TokenService::class),
                    $c->get(HomeworkService::class),
                );
            },

            // ── Shared: Push notifications ───────────────────────────────
            FcmClient::class => function ($c) {
                return new FcmClient($c->get(Connection::class)->getPdo());
            },

            PushDispatcher::class => function ($c) {
                return new PushDispatcher(
                    $c->get(Connection::class)->getPdo(),
                    $c->get(FcmClient::class),
                );
            },

            DeviceTokenService::class => function ($c) {
                return new DeviceTokenService($c->get(Connection::class)->getPdo());
            },

            DeviceTokenController::class => function ($c) {
                return new DeviceTokenController(
                    $c->get(TokenService::class),
                    $c->get(DeviceTokenService::class),
                    $c->get(PushDispatcher::class),
                );
            },
        ]);

        $container = $containerBuilder->build();
        AppFactory::setContainer($container);

        // ── 3. Build the Slim app ─────────────────────────────────────────────
        $app = AppFactory::create();

        // ── 4. Middleware ─────────────────────────────────────────────────────
        $app->addBodyParsingMiddleware();
        $app->addRoutingMiddleware();
        $app->add(\App\Shared\Http\AuditLoggingMiddleware::class);

        // CORS
        $app->add(function ($request, $handler) {
            $response = $handler->handle($request);
            return $response
                ->withHeader('Access-Control-Allow-Origin', '*')
                ->withHeader('Access-Control-Allow-Headers', 'X-Requested-With, Content-Type, Accept, Origin, Authorization')
                ->withHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS')
                ->withHeader('Access-Control-Allow-Credentials', 'true');
        });

        // Preflight
        $app->options('/{routes:.+}', function ($request, $response) {
            return $response;
        });

        // ── 5. Routes ─────────────────────────────────────────────────────────
        $routes = require __DIR__ . '/../Routes/api.php';
        $routes($app);

        // ── 6. Error middleware with custom handler ───────────────────────────
        $displayErrors = (bool) ($container->get('settings')['displayErrorDetails']);
        $errorMiddleware = $app->addErrorMiddleware($displayErrors, true, true);

        $responseFactory = $app->getResponseFactory();
        $errorHandler    = new ErrorHandler($responseFactory);
        $errorMiddleware->setDefaultErrorHandler($errorHandler);

        return $app;
    }
}
