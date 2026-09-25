<?php

declare(strict_types=1);

final class Config
{
    public static function load(): array
    {
        $envFile = dirname(__DIR__) . '/.env';
        $values = is_readable($envFile) ? parse_ini_file($envFile, false, INI_SCANNER_RAW) : [];
        if (!is_array($values)) {
            throw new RuntimeException('The backend environment file is invalid.');
        }

        foreach ($values as $key => $value) {
            if (getenv($key) === false) {
                putenv($key . '=' . $value);
            }
        }

        $dbPassword = self::env('DB_PASSWORD', '');
        $encodedPassword = self::env('DB_PASSWORD_B64', '');
        if ($encodedPassword !== '') {
            $decodedPassword = base64_decode($encodedPassword, true);
            if ($decodedPassword === false) {
                throw new RuntimeException('The database password configuration is invalid.');
            }
            $dbPassword = $decodedPassword;
        }

        return [
            'db_host' => self::env('DB_HOST', '127.0.0.1'),
            'db_port' => self::env('DB_PORT', '3306'),
            'db_name' => self::env('DB_NAME', ''),
            'db_user' => self::env('DB_USER', ''),
            'db_password' => $dbPassword,
            'frontend_origin' => self::env('FRONTEND_ORIGIN', 'https://drivvo.dginelsa.net'),
            'session_name' => self::env('SESSION_NAME', 'drivvo_session'),
        ];
    }

    private static function env(string $name, string $default): string
    {
        $value = getenv($name);
        return $value === false ? $default : $value;
    }
}
