<?php

namespace App\Domain\Auth\DTOs;

class LoginDTO
{
    public function __construct(
        public readonly string $email,
        public readonly string $password
    ) {}

    public static function fromArray(array $data): self
    {
        return new self(
            trim($data['email'] ?? ''),
            $data['password'] ?? ''
        );
    }
}
