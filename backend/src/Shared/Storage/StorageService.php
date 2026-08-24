<?php

declare(strict_types=1);

namespace App\Shared\Storage;

use Psr\Http\Message\UploadedFileInterface;

/**
 * Single entry point for every file this application stores.
 *
 * Driver is chosen by STORAGE_DRIVER:
 *   s3    — objects go to the bucket in AWS_BUCKET (shared across projects,
 *           namespaced by AWS_ROOT_FOLDER) and callers get back an absolute URL.
 *   local — objects go to backend/public/uploads/<category> and callers get
 *           back a "/uploads/<category>/<file>" path, as before.
 *
 * Keys are laid out as:  <root>/<category>/<YYYY>/<MM>/<random>.<ext>
 * so each kind of upload lives in its own folder inside the shared bucket.
 */
class StorageService
{
    // Every upload category the application knows about. The value is the
    // folder name inside the bucket (and inside public/uploads locally).
    public const CATEGORY_DOCUMENTS     = 'documents';
    public const CATEGORY_HOMEWORK      = 'homework';
    public const CATEGORY_LEAVE         = 'leave-attachments';
    public const CATEGORY_LOGOS         = 'school-logos';
    public const CATEGORY_SIGNATURES    = 'signatures';
    public const CATEGORY_STUDENT_PHOTO = 'student-photos';
    public const CATEGORY_STAFF_PHOTO   = 'staff-photos';
    public const CATEGORY_STUDENT_DOCS  = 'student-documents';
    public const CATEGORY_STAFF_DOCS    = 'staff-documents';
    public const CATEGORY_FINANCE       = 'finance';

    public const CATEGORIES = [
        self::CATEGORY_DOCUMENTS,
        self::CATEGORY_HOMEWORK,
        self::CATEGORY_LEAVE,
        self::CATEGORY_LOGOS,
        self::CATEGORY_SIGNATURES,
        self::CATEGORY_STUDENT_PHOTO,
        self::CATEGORY_STAFF_PHOTO,
        self::CATEGORY_STUDENT_DOCS,
        self::CATEGORY_STAFF_DOCS,
        self::CATEGORY_FINANCE,
    ];

    private string $driver;
    private string $rootFolder;
    private ?S3Client $s3 = null;

    public function __construct()
    {
        // Tolerate trailing inline comments / stray whitespace in .env values.
        $driver = strtolower(trim(explode('#', (string)(getenv('STORAGE_DRIVER') ?: 'local'))[0]));

        $this->rootFolder = trim($this->envValue('AWS_ROOT_FOLDER'), '/');

        if ($driver === 's3') {
            $s3 = new S3Client(
                $this->envValue('AWS_ACCESS_KEY_ID'),
                $this->envValue('AWS_SECRET_ACCESS_KEY'),
                $this->envValue('AWS_DEFAULT_REGION') ?: 'ap-south-1',
                $this->envValue('AWS_BUCKET'),
                $this->envValue('AWS_URL')
            );

            // Missing credentials must not take uploads down entirely; fall
            // back to disk and let the error surface in the logs instead.
            if ($s3->isConfigured()) {
                $this->s3 = $s3;
            } else {
                $driver = 'local';
                error_log('StorageService: STORAGE_DRIVER=s3 but AWS credentials are incomplete; falling back to local disk.');
            }
        }

        $this->driver = $driver === 's3' ? 's3' : 'local';
    }

    public function usesS3(): bool
    {
        return $this->driver === 's3' && $this->s3 !== null;
    }

    /**
     * Store an uploaded file under the given category.
     *
     * @param string $namePrefix optional prefix for the generated filename,
     *                           kept so existing "hw_" homework names survive.
     * @return array{url:string,key:string,filename:string,size:int,extension:string}
     * @throws StorageException
     */
    public function storeUploadedFile(
        UploadedFileInterface $file,
        string $category,
        string $namePrefix = ''
    ): array {
        $category  = $this->normaliseCategory($category);
        $extension = strtolower(pathinfo((string)$file->getClientFilename(), PATHINFO_EXTENSION));
        $filename  = $this->generateFilename($extension, $namePrefix);
        $size      = (int)$file->getSize();

        if ($this->usesS3()) {
            // moveTo() can only be called once, and we need the bytes here, so
            // read the stream directly instead.
            $stream = $file->getStream();
            $stream->rewind();
            $body = (string)$stream->getContents();

            $key = $this->buildKey($category, $filename);
            $url = $this->s3->putObject($key, $body, $this->contentTypeFor($extension, $file->getClientMediaType()));

            return [
                'url'       => $url,
                'key'       => $key,
                'filename'  => $filename,
                'size'      => $size,
                'extension' => $extension,
            ];
        }

        $directory = $this->localDirectory($category);
        $file->moveTo($directory . DIRECTORY_SEPARATOR . $filename);

        return [
            'url'       => '/uploads/' . $category . '/' . $filename,
            'key'       => $category . '/' . $filename,
            'filename'  => $filename,
            'size'      => $size,
            'extension' => $extension,
        ];
    }

    /**
     * Store raw bytes (used when an image is generated or rewritten server-side).
     *
     * @throws StorageException
     */
    public function storeContents(
        string $contents,
        string $category,
        string $filename,
        string $contentType = 'application/octet-stream'
    ): string {
        $category = $this->normaliseCategory($category);
        $filename = basename($filename);

        if ($this->usesS3()) {
            return $this->s3->putObject($this->buildKey($category, $filename), $contents, $contentType);
        }

        $directory = $this->localDirectory($category);
        if (@file_put_contents($directory . DIRECTORY_SEPARATOR . $filename, $contents) === false) {
            throw new StorageException('Unable to write the file to disk.');
        }

        return '/uploads/' . $category . '/' . $filename;
    }

    /**
     * Overwrite an object in place, given the URL/path previously returned by
     * this service. Used by the signature background-removal pass.
     */
    public function replaceContents(string $urlOrPath, string $contents, string $contentType): bool
    {
        if ($this->isRemoteUrl($urlOrPath)) {
            $key = $this->keyFromUrl($urlOrPath);
            if ($key === null || $this->s3 === null) {
                return false;
            }
            try {
                $this->s3->putObject($key, $contents, $contentType);
                return true;
            } catch (StorageException $e) {
                error_log('StorageService: failed to replace ' . $key . ': ' . $e->getMessage());
                return false;
            }
        }

        $path = $this->localPathFor($urlOrPath);

        return $path !== null && @file_put_contents($path, $contents) !== false;
    }

    /** Read back a stored file's bytes, whatever driver produced it. */
    public function readContents(string $urlOrPath): ?string
    {
        if ($this->isRemoteUrl($urlOrPath)) {
            $key = $this->keyFromUrl($urlOrPath);
            if ($key !== null && $this->s3 !== null) {
                return $this->s3->getObject($key);
            }
            // Foreign absolute URL (e.g. a legacy CDN link) — fetch it plainly.
            $body = @file_get_contents($urlOrPath);

            return $body === false ? null : $body;
        }

        $path = $this->localPathFor($urlOrPath);
        if ($path === null || !is_file($path)) {
            return null;
        }
        $body = @file_get_contents($path);

        return $body === false ? null : $body;
    }

    /** Best-effort delete; never throws, since callers treat this as cleanup. */
    public function delete(string $urlOrPath): bool
    {
        if ($urlOrPath === '') {
            return false;
        }

        if ($this->isRemoteUrl($urlOrPath)) {
            $key = $this->keyFromUrl($urlOrPath);

            return ($key !== null && $this->s3 !== null) ? $this->s3->deleteObject($key) : false;
        }

        $path = $this->localPathFor($urlOrPath);

        return $path !== null && is_file($path) && @unlink($path);
    }

    public function isRemoteUrl(string $value): bool
    {
        return str_starts_with($value, 'http://') || str_starts_with($value, 'https://');
    }

    /**
     * Map a stored absolute URL back to its bucket key, so we can re-read,
     * overwrite or delete the object. Returns null for URLs from another host.
     */
    public function keyFromUrl(string $url): ?string
    {
        if ($this->s3 === null) {
            return null;
        }

        $path = (string)parse_url($url, PHP_URL_PATH);
        if ($path === '') {
            return null;
        }
        $key = rawurldecode(ltrim($path, '/'));

        $host       = (string)parse_url($url, PHP_URL_HOST);
        $bucket     = $this->envValue('AWS_BUCKET');
        $configured = (string)parse_url($this->envValue('AWS_URL') ?: '', PHP_URL_HOST);

        // Path-style URLs (s3.<region>.amazonaws.com/<bucket>/<key>) carry the
        // bucket as the first path segment; strip it.
        if ($bucket !== '' && str_starts_with($key, $bucket . '/')) {
            $key = substr($key, strlen($bucket) + 1);
        }

        if ($configured !== '' && $host !== $configured && !str_contains($host, 'amazonaws.com')) {
            return null; // Not ours.
        }

        return $key !== '' ? $key : null;
    }

    /**
     * Presigned URL for a stored object, for buckets that are not public-read.
     * Returns the input unchanged when it is not an S3 object we own.
     */
    public function temporaryUrl(string $url, int $expiresInSeconds = 3600): string
    {
        $key = $this->isRemoteUrl($url) ? $this->keyFromUrl($url) : null;
        if ($key === null || $this->s3 === null) {
            return $url;
        }

        return $this->s3->presignedUrl($key, $expiresInSeconds);
    }

    /**
     * Is this reference something *we* stored, and therefore safe to read back
     * on behalf of a browser request?
     *
     * The media proxy hands a caller-supplied URL to readContents(), which will
     * happily file_get_contents() any absolute URL — including an internal one
     * like http://169.254.169.254/. Every proxied read must pass through here
     * first so the endpoint cannot be used to fetch arbitrary hosts (SSRF).
     */
    public function isOwnMedia(string $urlOrPath): bool
    {
        $value = trim($urlOrPath);
        if ($value === '' || str_contains($value, "\0")) {
            return false;
        }

        if ($this->isRemoteUrl($value)) {
            // keyFromUrl() returns null for any host that is not our bucket.
            return $this->keyFromUrl($value) !== null;
        }

        // Local driver / pre-S3 records: only the uploads tree, no traversal.
        $relative = ltrim(str_replace('\\', '/', $value), '/');
        if (str_contains($relative, '..')) {
            return false;
        }

        return str_starts_with($relative, 'uploads/');
    }

    /**
     * Content type for a stored reference, from its extension. Used when
     * serving bytes back to a browser, where a wrong type means a broken image.
     */
    public function contentTypeForPath(string $urlOrPath): string
    {
        $path      = (string)(parse_url($urlOrPath, PHP_URL_PATH) ?: $urlOrPath);
        $extension = strtolower(pathinfo($path, PATHINFO_EXTENSION));

        return $this->contentTypeFor($extension, null);
    }

    // -------------------------------------------------------------------------
    // Internals
    // -------------------------------------------------------------------------

    /** <root>/<category>/<YYYY>/<MM>/<filename> */
    private function buildKey(string $category, string $filename): string
    {
        $parts = array_filter([
            $this->rootFolder,
            $category,
            date('Y'),
            date('m'),
            $filename,
        ], static fn($p) => $p !== '');

        return implode('/', $parts);
    }

    private function generateFilename(string $extension, string $namePrefix = ''): string
    {
        $extension = preg_replace('/[^a-z0-9]/', '', $extension) ?: 'bin';
        $prefix    = $namePrefix !== '' ? preg_replace('/[^A-Za-z0-9_-]/', '', $namePrefix) . '_' : '';

        return sprintf('%s%s_%d.%s', $prefix, bin2hex(random_bytes(8)), time(), $extension);
    }

    private function normaliseCategory(string $category): string
    {
        $category = trim(strtolower($category), '/');

        return in_array($category, self::CATEGORIES, true) ? $category : self::CATEGORY_DOCUMENTS;
    }

    /** Local uploads root — the web-server document root when one is available. */
    private function localUploadsRoot(): string
    {
        $docRoot = $_SERVER['DOCUMENT_ROOT'] ?? '';
        if (!empty($docRoot) && is_dir($docRoot)) {
            $candidate = rtrim($docRoot, '/\\') . '/uploads';
            if (is_dir($candidate) || @mkdir($candidate, 0777, true) || is_dir($candidate)) {
                if (is_writable($candidate)) {
                    return $candidate;
                }
            }
        }

        return dirname(__DIR__, 3) . '/public/uploads';
    }

    private function localDirectory(string $category): string
    {
        $directory = $this->localUploadsRoot() . '/' . $category;
        if (!is_dir($directory)) {
            @mkdir($directory, 0777, true);
        }
        if (!is_dir($directory)) {
            throw new StorageException('Unable to create the uploads directory.');
        }

        return $directory;
    }

    /**
     * Resolve a stored "/uploads/..." path to a file on disk, checking the
     * legacy flat layout as well as the new per-category folders.
     */
    private function localPathFor(string $storedPath): ?string
    {
        $relative = ltrim(str_replace('\\', '/', $storedPath), '/');
        $relative = preg_replace('#^uploads/#', '', $relative) ?? $relative;
        if ($relative === '' || str_contains($relative, '..')) {
            return null;
        }

        $root       = $this->localUploadsRoot();
        $candidates = [$root . '/' . $relative];

        // Legacy files were written flat into public/uploads.
        $base = basename($relative);
        $candidates[] = $root . '/' . $base;
        foreach (self::CATEGORIES as $category) {
            $candidates[] = $root . '/' . $category . '/' . $base;
        }

        foreach ($candidates as $candidate) {
            if (is_file($candidate)) {
                return $candidate;
            }
        }

        // Nothing exists yet — return the primary path so writes can create it.
        return $candidates[0];
    }

    private function contentTypeFor(string $extension, ?string $clientMediaType): string
    {
        $map = [
            'jpg'  => 'image/jpeg',
            'jpeg' => 'image/jpeg',
            'png'  => 'image/png',
            'gif'  => 'image/gif',
            'webp' => 'image/webp',
            'svg'  => 'image/svg+xml',
            'pdf'  => 'application/pdf',
            'doc'  => 'application/msword',
            'docx' => 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            'xls'  => 'application/vnd.ms-excel',
            'xlsx' => 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'csv'  => 'text/csv',
            'txt'  => 'text/plain',
        ];

        if (isset($map[$extension])) {
            return $map[$extension];
        }

        // Never trust a client-supplied type that would let the browser run it.
        $clientMediaType = strtolower(trim((string)$clientMediaType));
        if ($clientMediaType !== '' && !str_contains($clientMediaType, 'html') && !str_contains($clientMediaType, 'script')) {
            return $clientMediaType;
        }

        return 'application/octet-stream';
    }

    private function envValue(string $name): string
    {
        $value = getenv($name);
        if ($value === false) {
            return '';
        }

        return trim($value);
    }
}
