<?php

declare(strict_types=1);

final class Validator
{
    public static function email(mixed $value): ?string
    {
        if (!is_string($value)) {
            return null;
        }

        $email = strtolower(trim($value));
        return strlen($email) <= 254 && filter_var($email, FILTER_VALIDATE_EMAIL) ? $email : null;
    }

    public static function password(mixed $value): bool
    {
        return is_string($value) && strlen($value) >= 12 && strlen($value) <= 200;
    }

    public static function text(mixed $value, int $maxLength): ?string
    {
        if (!is_string($value)) {
            return null;
        }

        $text = trim($value);
        return $text !== '' && strlen($text) <= $maxLength ? $text : null;
    }

    public static function amount(mixed $value): ?float
    {
        if (!is_numeric($value)) {
            return null;
        }

        $amount = (float) $value;
        return $amount > 0 && $amount <= 100000000 ? round($amount, 2) : null;
    }

    public static function odometer(mixed $value): ?int
    {
        if (filter_var($value, FILTER_VALIDATE_INT) === false) {
            return null;
        }

        $odometer = (int) $value;
        return $odometer >= 0 && $odometer <= 2000000000 ? $odometer : null;
    }

    public static function date(mixed $value): ?string
    {
        if (!is_string($value)) {
            return null;
        }

        $date = DateTimeImmutable::createFromFormat('!Y-m-d', $value);
        return $date && $date->format('Y-m-d') === $value ? $value : null;
    }
}
