<?php

declare(strict_types=1);

namespace HawkVision\Auth;

use Firebase\JWT\JWT;
use HawkVision\Models\DB;

class AuthController
{
    private string $jwtSecret;
    private int    $jwtTtl = 86400; // 24 hours

    public function __construct()
    {
        $this->jwtSecret = getenv('JWT_SECRET') ?: 'changeme';
    }

    public function register(): void
    {
        $body  = $this->json();
        $email = filter_var($body['email'] ?? '', FILTER_VALIDATE_EMAIL);
        $pass  = $body['password'] ?? '';

        if (!$email || strlen($pass) < 8) {
            http_response_code(422);
            echo json_encode(['error' => 'Valid email and password (min 8 chars) required']);
            return;
        }

        $db   = DB::connection();
        $stmt = $db->prepare('SELECT id FROM users WHERE email = ?');
        $stmt->execute([$email]);

        if ($stmt->fetch()) {
            http_response_code(409);
            echo json_encode(['error' => 'Email already registered']);
            return;
        }

        $hash = password_hash($pass, PASSWORD_BCRYPT);
        $db->prepare('INSERT INTO users (email, password_hash) VALUES (?, ?)')->execute([$email, $hash]);
        $userId = (int) $db->lastInsertId();

        http_response_code(201);
        echo json_encode(['token' => $this->issue($userId, $email)]);
    }

    public function login(): void
    {
        $body  = $this->json();
        $email = $body['email'] ?? '';
        $pass  = $body['password'] ?? '';

        $db   = DB::connection();
        $stmt = $db->prepare('SELECT id, password_hash FROM users WHERE email = ?');
        $stmt->execute([$email]);
        $user = $stmt->fetch();

        if (!$user || !password_verify($pass, $user['password_hash'])) {
            http_response_code(401);
            echo json_encode(['error' => 'Invalid credentials']);
            return;
        }

        echo json_encode(['token' => $this->issue((int) $user['id'], $email)]);
    }

    private function issue(int $userId, string $email): string
    {
        return JWT::encode([
            'sub'   => $userId,
            'email' => $email,
            'iat'   => time(),
            'exp'   => time() + $this->jwtTtl,
        ], $this->jwtSecret, 'HS256');
    }

    private function json(): array
    {
        return (array) json_decode(file_get_contents('php://input'), true);
    }
}
