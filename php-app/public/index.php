<?php

declare(strict_types=1);

require_once __DIR__ . '/../vendor/autoload.php';

use HawkVision\Auth\AuthController;
use HawkVision\Upload\UploadController;
use HawkVision\Jobs\JobController;

$method = $_SERVER['REQUEST_METHOD'];
$path   = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);

header('Content-Type: application/json');

// CORS for local dev
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Headers: Content-Type, Authorization');
if ($method === 'OPTIONS') {
    http_response_code(204);
    exit;
}

try {
    match (true) {
        $method === 'POST' && $path === '/api/auth/register'
            => (new AuthController())->register(),
        $method === 'POST' && $path === '/api/auth/login'
            => (new AuthController())->login(),
        $method === 'POST' && $path === '/api/upload/presign'
            => (new UploadController())->presign(),
        $method === 'POST' && $path === '/api/jobs'
            => (new JobController())->enqueue(),
        $method === 'GET'  && preg_match('#^/api/jobs/([^/]+)$#', $path, $m)
            => (new JobController())->status($m[1]),
        $method === 'GET'  && preg_match('#^/api/jobs/([^/]+)/tracks$#', $path, $m)
            => (new JobController())->tracks($m[1]),
        default => (function () {
            http_response_code(404);
            echo json_encode(['error' => 'Not found']);
        })()
    };
} catch (\Throwable $e) {
    http_response_code(500);
    echo json_encode(['error' => $e->getMessage()]);
}
