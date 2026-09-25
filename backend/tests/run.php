<?php

declare(strict_types=1);

require_once dirname(__DIR__) . '/src/Validator.php';
require_once dirname(__DIR__) . '/src/Config.php';

$testPassword = 'test-password/with+symbols=$';
putenv('DB_HOST=test-host');
putenv('DB_PORT=3306');
putenv('DB_NAME=test-database');
putenv('DB_USER=test-user');
putenv('DB_PASSWORD=');
putenv('DB_PASSWORD_B64=' . base64_encode($testPassword));
$testConfig = Config::load();

$checks = [
    'normalizes valid emails' => Validator::email(' Driver@Example.com ') === 'driver@example.com',
    'rejects invalid emails' => Validator::email('driver.example.com') === null,
    'requires long passwords' => Validator::password('a-strong-password') && !Validator::password('short'),
    'bounds text fields' => Validator::text(' Oil change ', 20) === 'Oil change' && Validator::text(str_repeat('x', 21), 20) === null,
    'accepts positive amounts' => Validator::amount('12.345') === 12.35 && Validator::amount('0') === null,
    'validates odometer readings' => Validator::odometer('52051') === 52051 && Validator::odometer('-1') === null,
    'rejects impossible dates' => Validator::date('2026-02-31') === null && Validator::date('2026-09-25') === '2026-09-25',
    'decodes encoded database passwords' => $testConfig['db_password'] === $testPassword,
];

foreach ($checks as $label => $passed) {
    if (!$passed) {
        fwrite(STDERR, "FAIL: {$label}\n");
        exit(1);
    }
    fwrite(STDOUT, "PASS: {$label}\n");
}
