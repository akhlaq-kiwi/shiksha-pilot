<?php

declare(strict_types=1);

use App\Bootstrap\App;

require __DIR__ . '/../vendor/autoload.php';

// Bootstrap and run the app
$app = App::create();
$app->run();
