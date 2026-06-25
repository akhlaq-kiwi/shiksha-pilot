<?php

declare(strict_types=1);

namespace App\Bootstrap;

use DI\ContainerBuilder;
use Slim\App as SlimApp;
use Slim\Factory\AppFactory;
use App\Database\Connection;

class App
{
    public static function create(): SlimApp
    {
        // Setup PHP-DI container
        $containerBuilder = new ContainerBuilder();
        
        $containerBuilder->addDefinitions([
            'settings' => [
                'displayErrorDetails' => true,
                'db' => [
                    'host' => getenv('DB_HOST') ?: 'db',
                    'dbname' => getenv('DB_NAME') ?: 'bn_school_sp',
                    'user' => getenv('DB_USER') ?: 'root',
                    'pass' => getenv('DB_PASS') ?: 'admin123',
                ]
            ],
            Connection::class => function ($container) {
                $dbSettings = $container->get('settings')['db'];
                return new Connection(
                    $dbSettings['host'],
                    $dbSettings['dbname'],
                    $dbSettings['user'],
                    $dbSettings['pass']
                );
            }
        ]);

        $container = $containerBuilder->build();
        AppFactory::setContainer($container);
        
        $app = AppFactory::create();

        // Middleware setup
        $app->addBodyParsingMiddleware();
        $app->addRoutingMiddleware();

        // CORS Middleware Setup
        $app->add(function ($request, $handler) {
            $response = $handler->handle($request);
            return $response
                ->withHeader('Access-Control-Allow-Origin', '*')
                ->withHeader('Access-Control-Allow-Headers', 'X-Requested-With, Content-Type, Accept, Origin, Authorization')
                ->withHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS')
                ->withHeader('Access-Control-Allow-Credentials', 'true');
        });

        // Handle preflight OPTIONS requests
        $app->options('/{routes:.+}', function ($request, $response) {
            return $response;
        });

        // Load Routes
        $routes = require __DIR__ . '/../Routes/api.php';
        $routes($app);

        // Add Error Middleware
        $app->addErrorMiddleware(true, true, true);

        return $app;
    }
}
