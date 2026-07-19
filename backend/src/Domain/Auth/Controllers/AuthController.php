<?php

declare(strict_types=1);

namespace App\Domain\Auth\Controllers;

use App\Domain\Auth\Services\AuthService;
use App\Shared\Auth\TokenService;
use App\Shared\BaseController;
use App\Shared\Http\RequestParser;
use Psr\Http\Message\ResponseInterface as Response;
use Psr\Http\Message\ServerRequestInterface as Request;

class AuthController extends BaseController
{
    public function __construct(
        private readonly AuthService $authService,
        TokenService $tokenService,
    ) {
        parent::__construct($tokenService);
    }

    /**
     * POST /auth/identify
     *
     * Body: { "phone": "..." }
     * Returns 200 when the phone exists; exceptions bubble to the global handler.
     */
    public function identify(Request $request, Response $response): Response
    {
        $body = RequestParser::body($request);
        RequestParser::required($body, ['phone']);

        $phone = (string) $body['phone'];

        $this->authService->identify($phone);

        return $this->success($response, null, 'Phone number found.');
    }

    /**
     * POST /auth/login
     *
     * Body: { "phone": "...", "password": "..." }
     * Returns 200 with token + user profile; exceptions bubble to the global handler.
     */
    public function login(Request $request, Response $response): Response
    {
        $body = RequestParser::body($request);
        RequestParser::required($body, ['phone', 'password']);

        $phone    = (string) $body['phone'];
        $password = (string) $body['password'];

        $subdomain = $request->getHeaderLine('X-School-Subdomain');
        if (empty($subdomain)) {
            $subdomain = null;
        }

        $clientType = $body['client_type'] ?? null;

        $result = $this->authService->login($phone, $password, $subdomain, $clientType);

        return $this->success($response, $result, 'Login successful.');
    }

    /**
     * POST /api/auth/change-password
     *
     * Body: { "new_password": "..." }
     * Requires a valid auth token.
     */
    public function changePassword(Request $request, Response $response): Response
    {
        $claims = $this->authenticate($request);
        $role = strtoupper($claims['role'] ?? '');

        $body = RequestParser::body($request);
        RequestParser::required($body, ['new_password']);

        $currentPassword = $body['current_password'] ?? null;

        // Strictly require current password for TEACHER and STUDENT roles!
        if ($role === 'TEACHER' || $role === 'STUDENT') {
            if ($currentPassword === null || $currentPassword === '') {
                throw new \App\Shared\Exceptions\ValidationException(['current_password' => 'Current password is required.']);
            }
        }

        $this->authService->changePassword(
            (int) $claims['id'], 
            $currentPassword, 
            (string) $body['new_password'], 
            $role
        );

        return $this->success($response, null, 'Password updated successfully.');
    }

    /**
     * GET /api/auth/profile
     *
     * Requires a valid auth token.
     */
    public function getProfile(Request $request, Response $response): Response
    {
        $claims = $this->authenticate($request);

        $profile = $this->authService->getProfile((int) $claims['id']);

        return $this->success($response, $profile, 'Profile fetched successfully.');
    }
}
