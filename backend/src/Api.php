<?php

declare(strict_types=1);

final class ApiException extends RuntimeException
{
    public function __construct(public readonly int $status, public readonly string $errorCode, string $message)
    {
        parent::__construct($message);
    }
}

final class Api
{
    public static function dispatch(PDO $database): never
    {
        $method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
        $path = parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH) ?: '/';
        if (!str_starts_with($path, '/api/v1/')) {
            self::fail(404, 'not_found', 'Endpoint not found.');
        }
        $route = substr($path, strlen('/api/v1'));

        if ($route === '/auth/csrf' && $method === 'GET') {
            $_SESSION['csrf_token'] ??= bin2hex(random_bytes(32));
            self::respond(['csrfToken' => $_SESSION['csrf_token']]);
        }
        if ($route === '/auth/register' && $method === 'POST') {
            self::checkCsrf();
            self::register($database);
        }
        if ($route === '/auth/login' && $method === 'POST') {
            self::checkCsrf();
            self::login($database);
        }
        if ($route === '/auth/me' && $method === 'GET') {
            $user = self::requireUser($database);
            self::respond(['user' => ['id' => (int) $user['id'], 'email' => $user['email']]]);
        }
        if ($route === '/auth/logout' && $method === 'POST') {
            self::requireUser($database);
            self::checkCsrf();
            $_SESSION = [];
            if (ini_get('session.use_cookies')) {
                $cookie = session_get_cookie_params();
                setcookie(session_name(), '', time() - 42000, $cookie['path'], $cookie['domain'], $cookie['secure'], $cookie['httponly']);
            }
            session_destroy();
            self::respond(['ok' => true]);
        }

        $user = self::requireUser($database);
        if ($route === '/vehicles' && $method === 'GET') {
            $query = $database->prepare('SELECT id, name, make, model, year, odometer, plate FROM vehicles WHERE user_id = ? ORDER BY id');
            $query->execute([$user['id']]);
            self::respond(['vehicles' => $query->fetchAll()]);
        }
        if ($route === '/vehicles' && $method === 'POST') {
            self::checkCsrf();
            self::createVehicle($database, (int) $user['id']);
        }
        if (preg_match('#^/vehicles/(\d+)$#', $route, $matches) && $method === 'PATCH') {
            self::checkCsrf();
            self::updateVehicle($database, (int) $user['id'], (int) $matches[1]);
        }
        if ($route === '/entries' && $method === 'GET') {
            self::listEntries($database, (int) $user['id']);
        }
        if ($route === '/entries' && $method === 'POST') {
            self::checkCsrf();
            self::createEntry($database, (int) $user['id']);
        }
        if (preg_match('#^/entries/(\d+)$#', $route, $matches) && $method === 'PATCH') {
            self::checkCsrf();
            self::updateEntry($database, (int) $user['id'], (int) $matches[1]);
        }
        if (preg_match('#^/entries/(\d+)$#', $route, $matches) && $method === 'DELETE') {
            self::checkCsrf();
            self::deleteEntry($database, (int) $user['id'], (int) $matches[1]);
        }
        if ($route === '/reminders' && $method === 'GET') {
            self::listReminders($database, (int) $user['id']);
        }
        if ($route === '/reminders' && $method === 'POST') {
            self::checkCsrf();
            self::createReminder($database, (int) $user['id']);
        }
        if (preg_match('#^/reminders/(\d+)$#', $route, $matches) && $method === 'PATCH') {
            self::checkCsrf();
            self::toggleReminder($database, (int) $user['id'], (int) $matches[1]);
        }
        if ($route === '/reports/summary' && $method === 'GET') {
            self::reportSummary($database, (int) $user['id']);
        }

        self::fail(404, 'not_found', 'Endpoint not found.');
    }

    private static function register(PDO $database): never
    {
        $body = self::body();
        $email = Validator::email($body['email'] ?? null);
        $password = $body['password'] ?? null;
        if ($email === null || !Validator::password($password)) {
            self::fail(422, 'invalid_input', 'Enter a valid email and a password of at least 12 characters.');
        }

        try {
            $insert = $database->prepare('INSERT INTO users (email, password_hash) VALUES (?, ?)');
            $insert->execute([$email, password_hash($password, PASSWORD_DEFAULT)]);
        } catch (PDOException $error) {
            if ($error->getCode() === '23000') {
                self::fail(409, 'email_exists', 'An account with that email already exists.');
            }
            throw $error;
        }

        self::startAuthenticatedSession((int) $database->lastInsertId());
        http_response_code(201);
        self::respond(['user' => ['id' => (int) $database->lastInsertId(), 'email' => $email]]);
    }

    private static function login(PDO $database): never
    {
        $body = self::body();
        $email = Validator::email($body['email'] ?? null);
        $password = $body['password'] ?? null;
        if ($email === null || !is_string($password)) {
            self::fail(422, 'invalid_input', 'Enter a valid email and password.');
        }

        $query = $database->prepare('SELECT id, email, password_hash FROM users WHERE email = ?');
        $query->execute([$email]);
        $user = $query->fetch();
        if (!$user || !password_verify($password, $user['password_hash'])) {
            self::fail(401, 'invalid_credentials', 'Email or password is incorrect.');
        }

        self::startAuthenticatedSession((int) $user['id']);
        self::respond(['user' => ['id' => (int) $user['id'], 'email' => $user['email']]]);
    }

    private static function startAuthenticatedSession(int $userId): void
    {
        session_regenerate_id(true);
        $_SESSION['user_id'] = $userId;
        $_SESSION['csrf_token'] = bin2hex(random_bytes(32));
    }

    private static function createVehicle(PDO $database, int $userId): never
    {
        $body = self::body();
        $make = Validator::text($body['make'] ?? null, 80);
        $model = Validator::text($body['model'] ?? null, 80);
        $name = Validator::text($body['name'] ?? ($make && $model ? $make . ' ' . $model : null), 100);
        $year = filter_var($body['year'] ?? null, FILTER_VALIDATE_INT);
        $odometer = Validator::odometer($body['odometer'] ?? 0);
        if ($make === null || $model === null || $name === null || $year === false || $year < 1950 || $year > (int) date('Y') + 1 || $odometer === null) {
            self::fail(422, 'invalid_vehicle', 'Provide a vehicle name, make, model, valid year, and odometer reading.');
        }

        $insert = $database->prepare('INSERT INTO vehicles (user_id, name, make, model, year, odometer, plate) VALUES (?, ?, ?, ?, ?, ?, ?)');
        $insert->execute([$userId, $name, $make, $model, $year, $odometer, Validator::text($body['plate'] ?? null, 24)]);
        http_response_code(201);
        self::respond(['vehicle' => ['id' => (int) $database->lastInsertId(), 'name' => $name, 'make' => $make, 'model' => $model, 'year' => $year, 'odometer' => $odometer, 'plate' => $body['plate'] ?? null]]);
    }

    private static function updateVehicle(PDO $database, int $userId, int $vehicleId): never
    {
        $body = self::body();
        $odometer = Validator::odometer($body['odometer'] ?? null);
        if ($odometer === null) {
            self::fail(422, 'invalid_odometer', 'Enter a valid odometer reading.');
        }
        $query = $database->prepare('UPDATE vehicles SET odometer = ? WHERE id = ? AND user_id = ?');
        $query->execute([$odometer, $vehicleId, $userId]);
        if ($query->rowCount() === 0 && !self::ownsVehicle($database, $userId, $vehicleId)) {
            self::fail(404, 'not_found', 'Vehicle not found.');
        }
        self::respond(['ok' => true]);
    }

    private static function listEntries(PDO $database, int $userId): never
    {
        $vehicleId = filter_input(INPUT_GET, 'vehicleId', FILTER_VALIDATE_INT);
        $sql = 'SELECT e.id, e.vehicle_id AS vehicleId, e.kind, e.title, e.amount, e.odometer, e.entry_date AS date, e.note FROM entries e JOIN vehicles v ON v.id = e.vehicle_id WHERE v.user_id = ?';
        $params = [$userId];
        if ($vehicleId !== null && $vehicleId !== false) {
            $sql .= ' AND e.vehicle_id = ?';
            $params[] = $vehicleId;
        }
        $sql .= ' ORDER BY e.entry_date DESC, e.id DESC LIMIT 500';
        $query = $database->prepare($sql);
        $query->execute($params);
        self::respond(['entries' => $query->fetchAll()]);
    }

    private static function createEntry(PDO $database, int $userId): never
    {
        $body = self::body();
        $vehicleId = filter_var($body['vehicleId'] ?? null, FILTER_VALIDATE_INT);
        $kind = $body['kind'] ?? null;
        $title = Validator::text($body['title'] ?? null, 100);
        $amount = Validator::amount($body['amount'] ?? null);
        $odometer = Validator::odometer($body['odometer'] ?? null);
        $date = Validator::date($body['date'] ?? null);
        if ($vehicleId === false || $vehicleId === null || !self::ownsVehicle($database, $userId, $vehicleId)) {
            self::fail(404, 'vehicle_not_found', 'Vehicle not found.');
        }
        if (!in_array($kind, ['fuel', 'expense', 'income', 'service'], true) || $title === null || $amount === null || $odometer === null || $date === null) {
            self::fail(422, 'invalid_entry', 'Provide a valid type, description, amount, odometer, and date.');
        }
        $note = isset($body['note']) ? Validator::text($body['note'], 180) : null;
        $insert = $database->prepare('INSERT INTO entries (vehicle_id, kind, title, amount, odometer, entry_date, note) VALUES (?, ?, ?, ?, ?, ?, ?)');
        $insert->execute([$vehicleId, $kind, $title, $amount, $odometer, $date, $note]);
        $update = $database->prepare('UPDATE vehicles SET odometer = GREATEST(odometer, ?) WHERE id = ? AND user_id = ?');
        $update->execute([$odometer, $vehicleId, $userId]);
        http_response_code(201);
        self::respond(['entry' => ['id' => (int) $database->lastInsertId(), 'vehicleId' => $vehicleId, 'kind' => $kind, 'title' => $title, 'amount' => $amount, 'odometer' => $odometer, 'date' => $date, 'note' => $note]]);
    }

    private static function deleteEntry(PDO $database, int $userId, int $entryId): never
    {
        $query = $database->prepare('DELETE e FROM entries e JOIN vehicles v ON v.id = e.vehicle_id WHERE e.id = ? AND v.user_id = ?');
        $query->execute([$entryId, $userId]);
        if ($query->rowCount() === 0) {
            self::fail(404, 'not_found', 'Entry not found.');
        }
        self::respond(['ok' => true]);
    }

    private static function updateEntry(PDO $database, int $userId, int $entryId): never
    {
        $body = self::body();
        $kind = $body['kind'] ?? null;
        $title = Validator::text($body['title'] ?? null, 100);
        $amount = Validator::amount($body['amount'] ?? null);
        $odometer = Validator::odometer($body['odometer'] ?? null);
        $date = Validator::date($body['date'] ?? null);
        if (!in_array($kind, ['fuel', 'expense', 'income', 'service'], true) || $title === null || $amount === null || $odometer === null || $date === null) {
            self::fail(422, 'invalid_entry', 'Provide a valid type, description, amount, odometer, and date.');
        }
        $ownerCheck = $database->prepare('SELECT e.vehicle_id FROM entries e JOIN vehicles v ON v.id = e.vehicle_id WHERE e.id = ? AND v.user_id = ?');
        $ownerCheck->execute([$entryId, $userId]);
        $vehicleId = $ownerCheck->fetchColumn();
        if ($vehicleId === false) {
            self::fail(404, 'not_found', 'Entry not found.');
        }
        $note = isset($body['note']) ? Validator::text($body['note'], 180) : null;
        $update = $database->prepare('UPDATE entries SET kind = ?, title = ?, amount = ?, odometer = ?, entry_date = ?, note = ? WHERE id = ?');
        $update->execute([$kind, $title, $amount, $odometer, $date, $note, $entryId]);
        $vehicleUpdate = $database->prepare('UPDATE vehicles SET odometer = GREATEST(odometer, ?) WHERE id = ? AND user_id = ?');
        $vehicleUpdate->execute([$odometer, $vehicleId, $userId]);
        self::respond(['entry' => ['id' => $entryId, 'vehicleId' => (int) $vehicleId, 'kind' => $kind, 'title' => $title, 'amount' => $amount, 'odometer' => $odometer, 'date' => $date, 'note' => $note]]);
    }

    private static function listReminders(PDO $database, int $userId): never
    {
        $query = $database->prepare('SELECT r.id, r.vehicle_id AS vehicleId, r.title, r.due_date AS dueDate, r.due_odometer AS dueOdometer, r.is_done AS done FROM reminders r JOIN vehicles v ON v.id = r.vehicle_id WHERE v.user_id = ? ORDER BY r.is_done, r.due_date, r.due_odometer LIMIT 500');
        $query->execute([$userId]);
        self::respond(['reminders' => $query->fetchAll()]);
    }

    private static function createReminder(PDO $database, int $userId): never
    {
        $body = self::body();
        $vehicleId = filter_var($body['vehicleId'] ?? null, FILTER_VALIDATE_INT);
        $title = Validator::text($body['title'] ?? null, 100);
        $date = isset($body['dueDate']) && $body['dueDate'] !== '' ? Validator::date($body['dueDate']) : null;
        $odometer = isset($body['dueOdometer']) && $body['dueOdometer'] !== '' ? Validator::odometer($body['dueOdometer']) : null;
        if ($vehicleId === false || $vehicleId === null || !self::ownsVehicle($database, $userId, $vehicleId)) {
            self::fail(404, 'vehicle_not_found', 'Vehicle not found.');
        }
        if ($title === null || ($date === null && $odometer === null)) {
            self::fail(422, 'invalid_reminder', 'Provide a title and a valid due date or odometer reading.');
        }
        $insert = $database->prepare('INSERT INTO reminders (vehicle_id, title, due_date, due_odometer) VALUES (?, ?, ?, ?)');
        $insert->execute([$vehicleId, $title, $date, $odometer]);
        http_response_code(201);
        self::respond(['reminder' => ['id' => (int) $database->lastInsertId(), 'vehicleId' => $vehicleId, 'title' => $title, 'dueDate' => $date, 'dueOdometer' => $odometer, 'done' => 0]]);
    }

    private static function toggleReminder(PDO $database, int $userId, int $reminderId): never
    {
        $query = $database->prepare('UPDATE reminders r JOIN vehicles v ON v.id = r.vehicle_id SET r.is_done = IF(r.is_done = 1, 0, 1) WHERE r.id = ? AND v.user_id = ?');
        $query->execute([$reminderId, $userId]);
        if ($query->rowCount() === 0) {
            self::fail(404, 'not_found', 'Reminder not found.');
        }
        self::respond(['ok' => true]);
    }

    private static function reportSummary(PDO $database, int $userId): never
    {
        $query = $database->prepare('SELECT e.kind, SUM(e.amount) AS total, COUNT(*) AS count FROM entries e JOIN vehicles v ON v.id = e.vehicle_id WHERE v.user_id = ? GROUP BY e.kind');
        $query->execute([$userId]);
        self::respond(['totals' => $query->fetchAll()]);
    }

    private static function requireUser(PDO $database): array
    {
        $userId = $_SESSION['user_id'] ?? null;
        if (!is_int($userId)) {
            self::fail(401, 'unauthorized', 'Sign in to continue.');
        }
        $query = $database->prepare('SELECT id, email FROM users WHERE id = ?');
        $query->execute([$userId]);
        $user = $query->fetch();
        if (!$user) {
            self::fail(401, 'unauthorized', 'Sign in to continue.');
        }
        return $user;
    }

    private static function ownsVehicle(PDO $database, int $userId, int $vehicleId): bool
    {
        $query = $database->prepare('SELECT 1 FROM vehicles WHERE id = ? AND user_id = ?');
        $query->execute([$vehicleId, $userId]);
        return (bool) $query->fetchColumn();
    }

    private static function checkCsrf(): void
    {
        $stored = $_SESSION['csrf_token'] ?? '';
        $sent = $_SERVER['HTTP_X_CSRF_TOKEN'] ?? '';
        if (!is_string($stored) || $stored === '' || !is_string($sent) || !hash_equals($stored, $sent)) {
            self::fail(403, 'csrf_failed', 'Refresh the page and try again.');
        }
    }

    private static function body(): array
    {
        $raw = file_get_contents('php://input');
        try {
            $body = json_decode($raw ?: '', true, 32, JSON_THROW_ON_ERROR);
        } catch (JsonException) {
            self::fail(400, 'invalid_json', 'Request body must be valid JSON.');
        }
        if (!is_array($body)) {
            self::fail(400, 'invalid_json', 'Request body must be a JSON object.');
        }
        return $body;
    }

    private static function respond(array $payload): never
    {
        echo json_encode($payload, JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR);
        exit;
    }

    private static function fail(int $status, string $code, string $message): never
    {
        throw new ApiException($status, $code, $message);
    }
}
