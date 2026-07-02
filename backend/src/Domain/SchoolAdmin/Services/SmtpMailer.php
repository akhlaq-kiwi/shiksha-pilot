<?php

declare(strict_types=1);

namespace App\Domain\SchoolAdmin\Services;

use RuntimeException;

class SmtpMailer
{
    /**
     * Send email via SMTP using socket stream.
     *
     * @param string $to
     * @param string $subject
     * @param string $bodyHtml
     * @param string $attachmentData
     * @param string $attachmentName
     * @return bool
     * @throws RuntimeException
     */
    public static function send(
        string $to,
        string $subject,
        string $bodyHtml,
        string $attachmentData,
        string $attachmentName
    ): bool {
        // Read configuration
        $host = getenv('SMTP_HOST') ?: 'smtp.gmail.com';
        $port = (int)(getenv('SMTP_PORT') ?: 587);
        $user = getenv('SMTP_USER') ?: 'shikshapilot@gmail.com';
        $pass = getenv('SMTP_PASS') ?: '';
        $fromName = getenv('SMTP_FROM_NAME') ?: 'ShikshaPilot';

        if (empty($user) || empty($pass)) {
            throw new RuntimeException("SMTP credentials are not configured. Please check SMTP_USER and SMTP_PASS.");
        }

        // Validate recipient email
        if (filter_var($to, FILTER_VALIDATE_EMAIL) === false) {
            throw new RuntimeException("Invalid recipient email: " . $to);
        }

        // Connect to server
        $socket = @fsockopen($host, $port, $errno, $errstr, 15);
        if (!$socket) {
            throw new RuntimeException("Failed to connect to SMTP server {$host}:{$port}. Error: {$errstr} ({$errno})");
        }

        try {
            self::expect($socket, '220');

            self::sendCmd($socket, "EHLO localhost");
            self::expect($socket, '250');

            // STARTTLS
            self::sendCmd($socket, "STARTTLS");
            self::expect($socket, '220');

            // Enable TLS crypto on standard stream socket
            if (!@stream_socket_enable_crypto($socket, true, STREAM_CRYPTO_METHOD_TLS_CLIENT)) {
                throw new RuntimeException("Failed to enable TLS encryption on SMTP socket.");
            }

            self::sendCmd($socket, "EHLO localhost");
            self::expect($socket, '250');

            // Authentication
            self::sendCmd($socket, "AUTH LOGIN");
            self::expect($socket, '334');

            self::sendCmd($socket, base64_encode($user));
            self::expect($socket, '334');

            self::sendCmd($socket, base64_encode($pass));
            self::expect($socket, '235');

            // Mail transactions
            self::sendCmd($socket, "MAIL FROM:<{$user}>");
            self::expect($socket, '250');

            self::sendCmd($socket, "RCPT TO:<{$to}>");
            self::expect($socket, '250');

            self::sendCmd($socket, "DATA");
            self::expect($socket, '354');

            // Prepare Email Content with Attachments
            $boundary = md5(uniqid((string)time(), true));

            $headers = [
                "From: {$fromName} <{$user}>",
                "To: {$to}",
                "Subject: =?UTF-8?B?" . base64_encode($subject) . "?=",
                "MIME-Version: 1.0",
                "Content-Type: multipart/mixed; boundary=\"{$boundary}\"",
                "Connection: close"
            ];

            $emailContent = implode("\r\n", $headers) . "\r\n\r\n";

            // Body
            $emailContent .= "--{$boundary}\r\n";
            $emailContent .= "Content-Type: text/html; charset=\"UTF-8\"\r\n";
            $emailContent .= "Content-Transfer-Encoding: base64\r\n\r\n";
            $emailContent .= chunk_split(base64_encode($bodyHtml)) . "\r\n";

            // Attachment
            if (!empty($attachmentData)) {
                $emailContent .= "--{$boundary}\r\n";
                $emailContent .= "Content-Type: application/vnd.ms-excel; name=\"{$attachmentName}\"\r\n";
                $emailContent .= "Content-Description: {$attachmentName}\r\n";
                $emailContent .= "Content-Disposition: attachment; filename=\"{$attachmentName}\"; size=" . strlen($attachmentData) . ";\r\n";
                $emailContent .= "Content-Transfer-Encoding: base64\r\n\r\n";
                $emailContent .= chunk_split(base64_encode($attachmentData)) . "\r\n";
            }

            $emailContent .= "--{$boundary}--\r\n";

            // Send Email Data
            fwrite($socket, $emailContent . "\r\n.\r\n");
            self::expect($socket, '250');

            self::sendCmd($socket, "QUIT");
            self::expect($socket, '221');
        } finally {
            fclose($socket);
        }

        return true;
    }

    private static function sendCmd($socket, string $cmd): void
    {
        fwrite($socket, $cmd . "\r\n");
    }

    private static function expect($socket, string $code): void
    {
        $response = '';
        while ($line = fgets($socket, 515)) {
            $response .= $line;
            if (substr($line, 3, 1) === ' ') {
                break;
            }
        }
        if (substr($response, 0, 3) !== $code) {
            throw new RuntimeException("SMTP Error. Expected code {$code}, received: " . trim($response));
        }
    }
}
