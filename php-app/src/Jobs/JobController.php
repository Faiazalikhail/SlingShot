<?php

declare(strict_types=1);

namespace HawkVision\Jobs;

use Predis\Client as Redis;
use HawkVision\Auth\Guard;
use HawkVision\Models\DB;

class JobController
{
    private Redis $redis;
    private const QUEUE = 'hawkvision';

    public function __construct()
    {
        $this->redis = new Redis(['host' => getenv('REDIS_HOST') ?: 'redis']);
    }

    /**
     * POST /api/jobs
     * Body: { "s3_key": "uploads/...", "fps": 30 }
     * Creates a session row and pushes a job onto the Redis queue.
     */
    public function enqueue(): void
    {
        $user = Guard::require();
        $body = (array) json_decode(file_get_contents('php://input'), true);

        $s3Key = $body['s3_key'] ?? '';
        $fps   = (float) ($body['fps'] ?? 30);

        if (!$s3Key) {
            http_response_code(422);
            echo json_encode(['error' => 's3_key required']);
            return;
        }

        $sessionId = $this->uuid();
        $videoUrl  = sprintf('s3://%s/%s', getenv('S3_BUCKET'), $s3Key);

        $db = DB::connection();
        $db->prepare(
            'INSERT INTO sessions (id, user_id, video_url, fps, status) VALUES (?, ?, ?, ?, ?)'
        )->execute([$sessionId, $user['sub'], $videoUrl, $fps, 'queued']);

        // Push JSON job payload; Python RQ worker will pick this up
        $payload = json_encode([
            'session_id' => $sessionId,
            's3_key'     => $s3Key,
            'fps'        => $fps,
            'user_id'    => $user['sub'],
        ]);
        $this->redis->lpush('rq:queue:' . self::QUEUE, [$this->rqJob($payload)]);

        http_response_code(202);
        echo json_encode(['session_id' => $sessionId, 'status' => 'queued']);
    }

    /**
     * GET /api/jobs/{sessionId}
     */
    public function status(string $sessionId): void
    {
        $user = Guard::require();

        $stmt = DB::connection()->prepare(
            'SELECT id, status, created_at FROM sessions WHERE id = ? AND user_id = ?'
        );
        $stmt->execute([$sessionId, $user['sub']]);
        $row = $stmt->fetch();

        if (!$row) {
            http_response_code(404);
            echo json_encode(['error' => 'Session not found']);
            return;
        }

        echo json_encode($row);
    }

    /**
     * GET /api/jobs/{sessionId}/tracks
     */
    public function tracks(string $sessionId): void
    {
        $user = Guard::require();
        $db   = DB::connection();

        $stmt = $db->prepare('SELECT id FROM sessions WHERE id = ? AND user_id = ?');
        $stmt->execute([$sessionId, $user['sub']]);

        if (!$stmt->fetch()) {
            http_response_code(404);
            echo json_encode(['error' => 'Session not found']);
            return;
        }

        $stmt = $db->prepare('SELECT track_data FROM session_tracks WHERE session_id = ?');
        $stmt->execute([$sessionId]);
        $row = $stmt->fetch();

        if (!$row) {
            http_response_code(404);
            echo json_encode(['error' => 'Tracks not ready']);
            return;
        }

        // track_data is already JSON; decode + re-encode to normalise
        echo json_encode(json_decode($row['track_data'], true));
    }

    // -------------------------------------------------------------------------

    private function uuid(): string
    {
        $data    = random_bytes(16);
        $data[6] = chr(ord($data[6]) & 0x0f | 0x40);
        $data[8] = chr(ord($data[8]) & 0x3f | 0x80);
        return vsprintf('%s%s-%s-%s-%s-%s%s%s', str_split(bin2hex($data), 4));
    }

    /**
     * Builds an RQ-compatible job envelope so the Python `rq worker` can
     * deserialise and execute it without a direct PHP→Python call.
     */
    private function rqJob(string $jsonPayload): string
    {
        $jobId = $this->uuid();
        return json_encode([
            'job_id'  => $jobId,
            'func'    => 'tasks.process_video',
            'args'    => [json_decode($jsonPayload, true)],
            'kwargs'  => [],
            'timeout' => 3600,
        ]);
    }
}
