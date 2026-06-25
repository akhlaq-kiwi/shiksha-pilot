<?php

declare(strict_types=1);

namespace App\Domain\Auth\Services;

use App\Domain\Auth\Repositories\AuthRepository;
use App\Shared\Auth\TokenService;
use App\Shared\BaseService;
use App\Shared\Exceptions\ForbiddenException;
use App\Shared\Exceptions\NotFoundException;
use App\Shared\Exceptions\ValidationException;

class AuthService extends BaseService
{
    public function __construct(
        private readonly AuthRepository $repo,
        private readonly TokenService $tokenService,
        ?\Psr\Log\LoggerInterface $logger = null,
    ) {
        parent::__construct($logger);
    }

    /**
     * Confirm that a user with the given phone number exists.
     *
     * @throws NotFoundException when no account is registered for that phone.
     */
    public function identify(string $phone): bool
    {
        $user = $this->repo->findByPhone($phone);

        if ($user === null) {
            throw new NotFoundException('No account found for the provided phone number.');
        }

        $this->log('Auth identify check', ['phone' => $phone]);

        return true;
    }

    /**
     * Authenticate a user by phone + password and return a token with the user profile.
     *
     * @return array{token: string, user: array<string, mixed>}
     *
     * @throws NotFoundException       when the phone number is not registered.
     * @throws ValidationException     when the password does not match.
     * @throws ForbiddenException      when the account is not in ACTIVE status.
     */
    public function login(string $phone, string $password): array
    {
        $user = $this->repo->findByPhone($phone);

        if ($user === null) {
            throw new NotFoundException('No account found for the provided phone number.');
        }

        if (!password_verify($password, (string) ($user['password'] ?? ''))) {
            throw new ValidationException(['password' => 'Invalid credentials.']);
        }

        if (($user['status'] ?? '') !== 'ACTIVE') {
            throw new ForbiddenException('Account is not active.');
        }

        $safeUser = array_diff_key($user, ['password' => true]);

        $token = $this->tokenService->encode([
            'id'    => $user['id'],
            'role'  => $user['role'] ?? null,
            'phone' => $user['phone'] ?? null,
        ]);

        $this->log('User logged in', ['id' => $user['id']]);

        return [
            'token' => $token,
            'user'  => $safeUser,
        ];
    }
}
