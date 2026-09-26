<?php

declare(strict_types=1);

require_once dirname(__DIR__) . '/src/Config.php';
require_once dirname(__DIR__) . '/src/Database.php';
require_once dirname(__DIR__) . '/src/Validator.php';
require_once dirname(__DIR__) . '/src/Api.php';

try {
    $config = Config::load();
} catch (Throwable) {
    error_log('Drivvo API configuration failed.');
    http_response_code(500);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode(['error' => ['code' => 'configuration_error', 'message' => 'The API is not configured.']]);
    exit;
}
$origin = $_SERVER['HTTP_ORIGIN'] ?? '';
if ($origin !== '' && hash_equals($config['frontend_origin'], $origin)) {
    header('Access-Control-Allow-Origin: ' . $origin);
    header('Access-Control-Allow-Credentials: true');
    header('Vary: Origin');
}

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
header('X-Content-Type-Options: nosniff');
header('Referrer-Policy: strict-origin-when-cross-origin');

if ($origin !== '' && !hash_equals($config['frontend_origin'], $origin)) {
    http_response_code(403);
    echo json_encode(['error' => ['code' => 'origin_denied', 'message' => 'Origin is not allowed.']]);
    exit;
}

if (($_SERVER['REQUEST_METHOD'] ?? 'GET') === 'OPTIONS') {
    header('Access-Control-Allow-Methods: GET, POST, PATCH, DELETE, OPTIONS');
    header('Access-Control-Allow-Headers: Content-Type, X-CSRF-Token');
    header('Access-Control-Max-Age: 600');
    http_response_code(204);
    exit;
}

$path = parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH) ?: '/';
if ($path === '/api/v1/health') {
    echo json_encode(['status' => 'ok']);
    exit;
}

try {
    $secure = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') || ($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? '') === 'https';
    session_name($config['session_name']);
    $sessionTtl = max(0, (int) ($config['session_ttl_seconds'] ?? 31536000));
    $sessionSavePath = trim((string) ($config['session_save_path'] ?? ''));
    if ($sessionSavePath !== '') {
        if (!is_dir($sessionSavePath) && !mkdir($sessionSavePath, 0700, true) && !is_dir($sessionSavePath)) {
            throw new RuntimeException('Session storage path is not available.');
        }
        if (!is_writable($sessionSavePath)) {
            throw new RuntimeException('Session storage path is not writable.');
        }
        ini_set('session.save_path', $sessionSavePath);
    }
    session_set_cookie_params([
        'lifetime' => $sessionTtl,
        'path' => '/',
        'secure' => $secure,
        'httponly' => true,
        'samesite' => 'Lax',
    ]);
    if ($sessionTtl > 0) {
        ini_set('session.gc_maxlifetime', (string) $sessionTtl);
    }
    ini_set('session.use_strict_mode', '1');
    ini_set('session.use_only_cookies', '1');
    session_start();

    if ($path === '/api/v1/auth/csrf' && ($_SERVER['REQUEST_METHOD'] ?? 'GET') === 'GET') {
        $_SESSION['csrf_token'] ??= bin2hex(random_bytes(32));
        echo json_encode(['csrfToken' => $_SESSION['csrf_token']]);
        exit;
    }

    $database = Database::connect($config);
    if ($path === '/api/v1/health/ready') {
        $database->query('SELECT 1');
        echo json_encode(['status' => 'ready']);
        exit;
    }

    Api::dispatch($database);
} catch (ApiException $error) {
    http_response_code($error->status);
    echo json_encode(['error' => ['code' => $error->errorCode, 'message' => $error->getMessage()]], JSON_UNESCAPED_SLASHES);
} catch (Throwable $error) {
    error_log('Drivvo API request failed.');
    http_response_code(500);
    echo json_encode(['error' => ['code' => 'internal_error', 'message' => 'The request could not be completed.']]);
}
