<?php

use Slim\App;
use App\Domain\Auth\Controllers\AuthController;

return function (App $app) {
    // Phase 1: Auth routes migrated to Domain Controller
    $app->post('/api/auth/identify', [AuthController::class, 'identify']);
    $app->post('/api/auth/login', [AuthController::class, 'login']);
    $app->post('/api/auth/otp-login', [AuthController::class, 'otpLogin']);
    $app->get('/api/auth/hash-defaults', [AuthController::class, 'hashDefaults']);
    $app->post('/api/auth/forgot-password', [AuthController::class, 'forgotPassword']);
    $app->post('/api/auth/verify-otp', [AuthController::class, 'verifyOtp']);
    $app->post('/api/auth/reset-password', [AuthController::class, 'resetPassword']);
    $app->post('/api/auth/verify-password', [AuthController::class, 'verifyPassword']);
};
