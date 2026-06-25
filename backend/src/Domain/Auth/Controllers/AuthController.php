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

        $result = $this->authService->login($phone, $password);

        return $this->success($response, $result, 'Login successful.');
    }
}
