<?php

declare(strict_types=1);

namespace HawkVision\Upload;

use Aws\S3\S3Client;
use HawkVision\Auth\Guard;

class UploadController
{
    public function presign(): void
    {
        $user = Guard::require();
        $body = (array) json_decode(file_get_contents('php://input'), true);

        $filename  = preg_replace('/[^a-zA-Z0-9._-]/', '_', $body['filename'] ?? '');
        $mimeType  = $body['mime_type'] ?? 'video/mp4';

        if (!$filename) {
            http_response_code(422);
            echo json_encode(['error' => 'filename required']);
            return;
        }

        $key    = sprintf('uploads/%d/%s/%s', $user['sub'], bin2hex(random_bytes(8)), $filename);
        $client = $this->s3();

        $cmd = $client->getCommand('PutObject', [
            'Bucket'      => getenv('S3_BUCKET'),
            'Key'         => $key,
            'ContentType' => $mimeType,
        ]);

        $request = $client->createPresignedRequest($cmd, '+15 minutes');

        echo json_encode([
            'upload_url' => (string) $request->getUri(),
            's3_key'     => $key,
        ]);
    }

    private function s3(): S3Client
    {
        return new S3Client([
            'version'     => 'latest',
            'region'      => getenv('S3_REGION') ?: 'us-east-1',
            'credentials' => [
                'key'    => getenv('S3_KEY'),
                'secret' => getenv('S3_SECRET'),
            ],
        ]);
    }
}
