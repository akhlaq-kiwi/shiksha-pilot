<?php

namespace App\Domain\Auth\Controllers;

use App\Shared\BaseController;
use App\Domain\Auth\Services\AuthService;
use Psr\Http\Message\ResponseInterface as Response;
use Psr\Http\Message\ServerRequestInterface as Request;

class AuthController extends BaseController
{
    public function __construct(
        private AuthService $authService
    ) {}

    public function identify(Request $request, Response $response): Response
    {
        $data = $this->getJsonData($request);
        $identifier = $data['identifier'] ?? '';

        if (empty($identifier)) {
            return $this->error($response, 'Email address or mobile number is required.', 400);
        }

        $result = $this->authService->identify($identifier);
        return $this->success($response, $result, $result['exists'] ? 200 : 404);
    }

    public function login(Request $request, Response $response): Response
    {
        $data = $this->getJsonData($request);
        $email = $data['email'] ?? '';
        $password = $data['password'] ?? '';

        if (empty($email) || empty($password)) {
            return $this->error($response, 'Email/Mobile and password are required.', 400);
        }

        try {
            $result = $this->authService->login($email, $password);
            return $this->success($response, $result);
        } catch (\Exception $e) {
            $status = $e->getCode() >= 400 && $e->getCode() < 600 ? $e->getCode() : 401;
            return $this->error($response, $e->getMessage(), $status);
        }
    }

    public function otpLogin(Request $request, Response $response): Response
    {
        $data = $this->getJsonData($request);
        $phone = $data['phone'] ?? '';
        $otp = $data['otp'] ?? '';

        if (empty($phone) || empty($otp)) {
            return $this->error($response, 'Mobile number and OTP are required.', 400);
        }

        try {
            $result = $this->authService->otpLogin($phone, $otp);
            return $this->success($response, $result);
        } catch (\Exception $e) {
            $status = $e->getCode() >= 400 && $e->getCode() < 600 ? $e->getCode() : 400;
            return $this->error($response, $e->getMessage(), $status);
        }
    }

    public function hashDefaults(Request $request, Response $response): Response
    {
        $result = [
            'super' => password_hash(hash('sha256', 'Bilal@123'), PASSWORD_BCRYPT),
            'admin' => password_hash(hash('sha256', 'Admin@123'), PASSWORD_BCRYPT)
        ];
        return $this->success($response, $result);
    }

    public function forgotPassword(Request $request, Response $response): Response
    {
        $data = $this->getJsonData($request);
        $email = $data['email'] ?? '';

        if (empty($email)) {
            return $this->error($response, 'Email address is required.', 400);
        }

        try {
            $result = $this->authService->forgotPassword($email);
            return $this->success($response, $result);
        } catch (\Exception $e) {
            $status = $e->getCode() >= 400 && $e->getCode() < 600 ? $e->getCode() : 404;
            return $this->error($response, $e->getMessage(), $status);
        }
    }

    public function verifyOtp(Request $request, Response $response): Response
    {
        $data = $this->getJsonData($request);
        $email = $data['email'] ?? '';
        $otp = $data['otp'] ?? '';

        if (empty($email) || empty($otp)) {
            return $this->error($response, 'Email and OTP are required.', 400);
        }

        $verified = $this->authService->verifyOtp($email, $otp);
        if ($verified) {
            return $this->success($response, ['success' => true, 'message' => 'OTP verified successfully.']);
        }

        return $this->error($response, 'Invalid or expired OTP.', 400);
    }

    public function resetPassword(Request $request, Response $response): Response
    {
        $data = $this->getJsonData($request);
        $email = $data['email'] ?? '';
        $otp = $data['otp'] ?? '';
        $password = $data['password'] ?? '';

        if (empty($email) || empty($otp) || empty($password)) {
            return $this->error($response, 'Email, OTP, and Password are required.', 400);
        }

        $reset = $this->authService->resetPassword($email, $otp, $password);
        if ($reset) {
            return $this->success($response, ['success' => true, 'message' => 'Password reset successfully.']);
        }

        return $this->error($response, 'Invalid or expired OTP session.', 400);
    }

    public function verifyPassword(Request $request, Response $response): Response
    {
        $auth = null;
        if (function_exists('getAuthUser')) {
            $auth = getAuthUser($request);
        }

        if (!$auth) {
            return $this->error($response, 'Unauthorized.', 401);
        }

        $data = $this->getJsonData($request);
        $password = $data['password'] ?? '';

        if (empty($password)) {
            return $this->error($response, 'Password is required.', 400);
        }

        $verified = $this->authService->verifyPassword((int)$auth['sub'], $password);
        if ($verified) {
            return $this->success($response, ['valid' => true]);
        }

        return $this->success($response, ['valid' => false]);
    }
}
