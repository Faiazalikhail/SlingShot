<?php

declare(strict_types=1);

namespace HawkVision\Auth;

use Firebase\JWT\JWT;
use Firebase\JWT\Key;

class Guard
{
    public static function require(): array
    {
        $header = $_SERVER['HTTP_AUTHORIZATION'] ?? '';
        $token  = str_starts_with($header, 'Bearer ') ? substr($header, 7) : null;

        if (!$token) {
            http_response_code(401);
            echo json_encode(['error' => 'Missing token']);
            exit;
        }

        try {
            $secret  = getenv('JWT_SECRET') ?: 'changeme';
            $payload = JWT::decode($token, new Key($secret, 'HS256'));
            return (array) $payload;
        } catch (\Throwable) {
            http_response_code(401);
            echo json_encode(['error' => 'Invalid or expired token']);
            exit;
        }
    }
}
