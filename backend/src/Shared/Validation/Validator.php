<?php

declare(strict_types=1);

namespace App\Shared\Validation;

use App\Shared\Exceptions\ValidationException;

class Validator
{
    private array $errors = [];

    private function __construct(
        private readonly array $data,
        private readonly array $rules,
    ) {}

    /**
     * Create a new Validator instance.
     *
     * @param array $data  The input data to validate.
     * @param array $rules Map of field => pipe-separated rule string.
     *                     e.g. ['email' => 'required|email|max:255']
     */
    public static function make(array $data, array $rules): self
    {
        return new self($data, $rules);
    }

    /**
     * Run all rules and throw ValidationException if any fail.
     *
     * @throws ValidationException
     */
    public function validate(): void
    {
        foreach ($this->rules as $field => $ruleString) {
            $this->applyRules($field, $ruleString);
        }

        if (count($this->errors) > 0) {
            throw ValidationException::fromErrors($this->errors);
        }
    }

    // -------------------------------------------------------------------------
    // Internal helpers
    // -------------------------------------------------------------------------

    private function applyRules(string $field, string $ruleString): void
    {
        $ruleList = array_filter(array_map('trim', explode('|', $ruleString)));
        $value    = $this->data[$field] ?? null;

        foreach ($ruleList as $rule) {
            // Stop further checks on a field once it has an error recorded.
            if (isset($this->errors[$field])) {
                break;
            }

            [$ruleName, $ruleParam] = $this->parseRule($rule);

            $this->applyRule($field, $value, $ruleName, $ruleParam);
        }
    }

    /**
     * @return array{0: string, 1: string|null}
     */
    private function parseRule(string $rule): array
    {
        if (str_contains($rule, ':')) {
            [$name, $param] = explode(':', $rule, 2);
            return [trim($name), trim($param)];
        }

        return [trim($rule), null];
    }

    private function applyRule(string $field, mixed $value, string $rule, ?string $param): void
    {
        match ($rule) {
            'required' => $this->checkRequired($field, $value),
            'email'    => $this->checkEmail($field, $value),
            'numeric'  => $this->checkNumeric($field, $value),
            'min'      => $this->checkMin($field, $value, (int) $param),
            'max'      => $this->checkMax($field, $value, (int) $param),
            'in'       => $this->checkIn($field, $value, $param ?? ''),
            default    => null,
        };
    }

    private function checkRequired(string $field, mixed $value): void
    {
        if ($value === null || $value === '') {
            $this->errors[$field] = "The {$field} field is required.";
        }
    }

    private function checkEmail(string $field, mixed $value): void
    {
        if ($value === null || $value === '') {
            return; // Let required handle absence.
        }

        if (filter_var($value, FILTER_VALIDATE_EMAIL) === false) {
            $this->errors[$field] = "The {$field} field must be a valid email address.";
        }
    }

    private function checkNumeric(string $field, mixed $value): void
    {
        if ($value === null || $value === '') {
            return;
        }

        if (!is_numeric($value)) {
            $this->errors[$field] = "The {$field} field must be numeric.";
        }
    }

    private function checkMin(string $field, mixed $value, int $min): void
    {
        if ($value === null || $value === '') {
            return;
        }

        if (is_numeric($value)) {
            if ((float) $value < $min) {
                $this->errors[$field] = "The {$field} field must be at least {$min}.";
            }
        } else {
            if (mb_strlen((string) $value) < $min) {
                $this->errors[$field] = "The {$field} field must be at least {$min} characters.";
            }
        }
    }

    private function checkMax(string $field, mixed $value, int $max): void
    {
        if ($value === null || $value === '') {
            return;
        }

        if (is_numeric($value)) {
            if ((float) $value > $max) {
                $this->errors[$field] = "The {$field} field must not exceed {$max}.";
            }
        } else {
            if (mb_strlen((string) $value) > $max) {
                $this->errors[$field] = "The {$field} field must not exceed {$max} characters.";
            }
        }
    }

    private function checkIn(string $field, mixed $value, string $param): void
    {
        if ($value === null || $value === '') {
            return;
        }

        $allowed = array_map('trim', explode(',', $param));

        if (!in_array((string) $value, $allowed, true)) {
            $list = implode(', ', $allowed);
            $this->errors[$field] = "The {$field} field must be one of: {$list}.";
        }
    }
}
