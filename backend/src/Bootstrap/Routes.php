<?php

namespace App\Bootstrap;

use Slim\App;

class Routes
{
    public static function register(App $app): void
    {
        // Load API routes
        $apiRoutes = require __DIR__ . '/../Routes/api.php';
        $apiRoutes($app);
    }
}
