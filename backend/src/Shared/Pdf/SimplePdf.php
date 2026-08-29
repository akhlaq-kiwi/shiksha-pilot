<?php

declare(strict_types=1);

namespace App\Shared\Pdf;

class SimplePdf
{
    private string $buffer = '';
    private array $offsets = [];
    private bool $isPng = false;
    private int $logoPixelWidth = 0;
    private int $logoPixelHeight = 0;
    private bool $hasSMask = false;
    private string $smaskStream = '';

    public function __construct()
    {
        $this->buffer = "%PDF-1.4\n";
    }

    private function write(string $str): void
    {
        $this->buffer .= $str . "\n";
    }

    private function obj(int $id): void
    {
        $this->offsets[$id] = strlen($this->buffer);
        $this->write("$id 0 obj");
    }

    private function endobj(): void
    {
        $this->write("endobj");
    }

    public function render(string $title, array $lines): string
    {
        $isFeeReceipt = false;
        $isSalarySlip = false;

        if (strtoupper(trim($title)) === 'SALARY SLIP') {
            $isSalarySlip = true;
        }

        $fields = [];
        $footerLines = [];

        foreach ($lines as $line) {
            $line = trim($line);
            if ($line === '---' || empty($line)) {
                continue;
            }
            if (str_contains(strtoupper($line), 'FEE PAYMENT RECEIPT')) {
                $isFeeReceipt = true;
                continue;
            }
            if (str_contains(strtoupper($line), 'SALARY SLIP')) {
                $isSalarySlip = true;
                continue;
            }

            if (str_contains($line, ':')) {
                [$key, $val] = explode(':', $line, 2);
                $fields[trim($key)] = trim($val);
            } else {
                $footerLines[] = $line;
            }
        }

        // --- school logo processing ---
        $logoObjId = 0;
        $logoWidth = 0;
        $logoHeight = 0;
        $imgStream = '';
        $logoPath = $fields['Logo Path'] ?? '';

        if (($isFeeReceipt || $isSalarySlip) && !empty($logoPath)) {
            $imageData = null;

            // 1. If logoPath is a full HTTP/HTTPS URL (e.g. S3 bucket URL)
            if (str_starts_with($logoPath, 'http://') || str_starts_with($logoPath, 'https://')) {
                $context = stream_context_create([
                    'http' => ['timeout' => 5, 'follow_location' => 1],
                    'ssl'  => ['verify_peer' => false, 'verify_peer_name' => false]
                ]);
                $imageData = @file_get_contents($logoPath, false, $context);
            }

            // 2. If not loaded yet, check local file paths
            if (empty($imageData)) {
                $cleanPath = '/' . ltrim($logoPath, '/');
                $searchPaths = [
                    dirname(__DIR__, 3) . '/public' . $cleanPath,
                    dirname(__DIR__, 3) . $cleanPath,
                    dirname(__DIR__, 4) . '/public' . $cleanPath,
                    dirname(__DIR__, 4) . $cleanPath,
                    'd:/BN School/backend/public' . $cleanPath
                ];
                foreach ($searchPaths as $p) {
                    if (file_exists($p)) {
                        $imageData = @file_get_contents($p);
                        break;
                    }
                }
            }

            // 3. If relative path and S3 base URL is configured
            if (empty($imageData)) {
                $s3Base = getenv('STORAGE_URL') ?: (getenv('S3_URL') ?: (getenv('AWS_BUCKET_URL') ?: ''));
                if (!empty($s3Base)) {
                    $fullS3Url = rtrim($s3Base, '/') . '/' . ltrim($logoPath, '/');
                    $context = stream_context_create([
                        'http' => ['timeout' => 5, 'follow_location' => 1],
                        'ssl'  => ['verify_peer' => false, 'verify_peer_name' => false]
                    ]);
                    $imageData = @file_get_contents($fullS3Url, false, $context);
                }
            }

            if (!empty($imageData)) {
                try {
                    $info = @getimagesizefromstring($imageData);
                    if ($info) {
                        $w = $info[0];
                        $h = $info[1];
                        $mime = $info['mime'];

                        $maxW = 138;
                        $maxH = 52;
                        $scale = min($maxW / $w, $maxH / $h, 1.0);
                        $logoWidth = (int)($w * $scale);
                        $logoHeight = (int)($h * $scale);

                        // Method 1: Try GD conversion first (if GD is loaded)
                        if (function_exists('imagecreatefromstring')) {
                            $srcImg = @imagecreatefromstring($imageData);

                            if ($srcImg) {
                                $destImg = imagecreatetruecolor($logoWidth, $logoHeight);
                                $white = imagecolorallocate($destImg, 255, 255, 255);
                                imagefill($destImg, 0, 0, $white);
                                imagecopyresampled($destImg, $srcImg, 0, 0, 0, 0, $logoWidth, $logoHeight, $w, $h);

                                ob_start();
                                imagejpeg($destImg, null, 90);
                                $imgStream = ob_get_clean();

                                imagedestroy($srcImg);
                                imagedestroy($destImg);

                                if (!empty($imgStream)) {
                                    $logoObjId = 5;
                                    $this->isPng = false;
                                    $this->logoPixelWidth = $logoWidth;
                                    $this->logoPixelHeight = $logoHeight;
                                }
                            }
                        }

                        // Method 2: Direct file loading fallback (if GD is missing)
                        if ($logoObjId === 0) {
                            if ($mime === 'image/jpeg' || $mime === 'image/jpg') {
                                $imgStream = $imageData;
                                if (!empty($imgStream)) {
                                    $logoObjId = 5;
                                    $this->isPng = false;
                                    $this->logoPixelWidth = $w;
                                    $this->logoPixelHeight = $h;
                                }
                            } elseif ($mime === 'image/png') {
                                $pngInfo = $this->parsePng($imageData);
                                if ($pngInfo) {
                                    $imgStream = $pngInfo['data'];
                                    $logoObjId = 5;
                                    $this->isPng = true;
                                    $this->logoPixelWidth = $pngInfo['width'];
                                    $this->logoPixelHeight = $pngInfo['height'];
                                    if (!empty($pngInfo['smask'])) {
                                        $this->hasSMask = true;
                                        $this->smaskStream = $pngInfo['smask'];
                                    }
                                }
                            }
                        }
                    }
                } catch (\Throwable $t) {
                    // Ignore errors, keep empty
                }
            }
        }

        // Obj 1: Catalog
        $this->obj(1);
        $this->write("<< /Type /Catalog /Pages 2 0 R >>");
        $this->endobj();

        // Obj 2: Pages
        $this->obj(2);
        $this->write("<< /Type /Pages /Kids [3 0 R] /Count 1 >>");
        $this->endobj();

        // Obj 3: Page
        $this->obj(3);
        $xObjectStr = $logoObjId > 0 ? " /XObject << /Img1 {$logoObjId} 0 R >>" : "";
        $this->write("<< /Type /Page /Parent 2 0 R /Resources << /Font << /F1 << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> /F2 << /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >> >>{$xObjectStr} >> /MediaBox [0 0 595.28 841.89] /Contents 4 0 R >>");
        $this->endobj();

        $stream = "";

        if ($isFeeReceipt) {
            // =========================================================================
            // REDESIGNED FEE PAYMENT RECEIPT
            // =========================================================================
            $schoolName = strtoupper(trim($title));
            $receiptTitle = "FEE PAYMENT RECEIPT";
            
            $studentName = $fields['Student Name'] ?? '—';
            $classSection = $fields['Class & Section'] ?? '—';
            $rollSr = $fields['Roll Number / SR No'] ?? '—';
            
            $rollNo = '—';
            $admissionNo = '—';
            if (str_contains($rollSr, '/')) {
                [$r, $s] = explode('/', $rollSr, 2);
                $rollNo = trim($r);
                $admissionNo = trim($s);
            } else {
                $rollNo = $rollSr;
            }

            $receiptNo = $fields['Ref No'] ?? '—';
            $academicYear = $fields['Academic Year'] ?? '2026-2027';
            $paymentDate = $fields['Payment Date'] ?? '—';
            $paymentMode = $fields['Mode of Payment'] ?? '—';
            $billingMonths = $fields['Month'] ?? $fields['Months'] ?? $fields['Billing Month'] ?? $fields['Billing Months'] ?? $fields['Description'] ?? '—';
            
            // Whole numbers formatting for Amount Paid (strip INR/Rs labels)
            $amountPaid = $fields['Total Amount'] ?? '—';
            $amountPaid = str_replace(['.00', 'INR ', 'INR', 'Rs. ', 'Rs', '₹'], '', $amountPaid);
            $amountPaid = trim($amountPaid);

            // 1. Draw Graphics elements
            // Outer light gray border
            $stream .= "0.85 0.85 0.85 RG\n";
            $stream .= "0.75 w\n";
            $stream .= "45 45 505.28 751.89 re\n";
            $stream .= "S\n";

            // Draw Logo image if loaded
            if ($logoObjId > 0 && !empty($imgStream)) {
                $logoX = (595.28 - $logoWidth) / 2;
                $stream .= "q\n";
                $stream .= "{$logoWidth} 0 0 {$logoHeight} " . number_format($logoX, 2, '.', '') . " 730 cm\n";
                $stream .= "/Img1 Do\n";
                $stream .= "Q\n";
            }

            // Thin Slate-Blue Divider
            $stream .= "0.09 0.17 0.35 RG\n";
            $stream .= "0.75 w\n";
            $stream .= "50 655 m 545.28 655 l S\n";

            // Grid Boxes
            $stream .= "0.88 0.90 0.94 RG\n";
            $stream .= "0.5 w\n";
            
            // Student details box
            $stream .= "45 545 505.28 65 re\n";
            $stream .= "S\n";

            // Payment details box
            $stream .= "45 435 505.28 70 re\n";
            $stream .= "S\n";

            // Vector drawing of a white-background, rounded-border Amount Card
            $amtX = (595.28 - 220) / 2;
            // Chunk billing months (max 4 months per line)
            $rawMonths = array_filter(array_map('trim', explode(',', $billingMonths)));
            if (count($rawMonths) > 1) {
                $chunks = array_chunk($rawMonths, 4);
                $monthLines = array_map(function($chunk) {
                    return implode(', ', $chunk);
                }, $chunks);
            } else {
                $monthLines = [$billingMonths];
            }
            $extraLinesCount = count($monthLines) - 1;
            $extraShift = $extraLinesCount * 14;

            $amtBoxTop = 400 - $extraShift;
            $amtBoxBottom = 320 - $extraShift;

            // Draw Amount Box background fill and border
            $stream .= "1.0 1.0 1.0 rg\n"; // White background fill
            $stream .= "193.64 " . $amtBoxBottom . " m\n";
            $stream .= "401.64 " . $amtBoxBottom . " l\n";
            $stream .= "407.64 " . ($amtBoxBottom + 6) . " l\n";
            $stream .= "407.64 " . ($amtBoxTop - 6) . " l\n";
            $stream .= "401.64 " . $amtBoxTop . " l\n";
            $stream .= "193.64 " . $amtBoxTop . " l\n";
            $stream .= "187.64 " . ($amtBoxTop - 6) . " l\n";
            $stream .= "187.64 " . ($amtBoxBottom + 6) . " l\n";
            $stream .= "193.64 " . $amtBoxBottom . " l\n";
            $stream .= "f\n";

            $stream .= "0.70 0.78 0.92 RG\n"; // Thin light blue/gray border
            $stream .= "1 w\n";
            $stream .= "193.64 " . $amtBoxBottom . " m\n";
            $stream .= "401.64 " . $amtBoxBottom . " l\n";
            $stream .= "407.64 " . ($amtBoxBottom + 6) . " l\n";
            $stream .= "407.64 " . ($amtBoxTop - 6) . " l\n";
            $stream .= "401.64 " . $amtBoxTop . " l\n";
            $stream .= "193.64 " . $amtBoxTop . " l\n";
            $stream .= "187.64 " . ($amtBoxTop - 6) . " l\n";
            $stream .= "187.64 " . ($amtBoxBottom + 6) . " l\n";
            $stream .= "193.64 " . $amtBoxBottom . " l\n";
            $stream .= "S\n";

            // 2. Draw Text elements
            $stream .= "BT\n";

            // School Name
            $stream .= "0.09 0.17 0.35 rg\n";
            $stream .= "/F2 18 Tf\n";
            $schNameX = (595.28 - $this->getStringWidth($schoolName, 18)) / 2;
            $stream .= "1 0 0 1 " . number_format($schNameX, 2, '.', '') . " 695 Tm\n";
            $stream .= "(" . $this->escape($schoolName) . ") Tj\n";

            // Document Title
            $stream .= "/F2 11 Tf\n";
            $stream .= "0.3 0.3 0.3 rg\n";
            $titleX = (595.28 - $this->getStringWidth($receiptTitle, 11)) / 2;
            $stream .= "1 0 0 1 " . number_format($titleX, 2, '.', '') . " 675 Tm\n";
            $stream .= "(" . $this->escape($receiptTitle) . ") Tj\n";

            // Centered Academic Year under the title
            $stream .= "/F1 9.5 Tf\n";
            $stream .= "0.4 0.4 0.4 rg\n";
            $metaStr = "Academic Year: {$academicYear}";
            $metaX = (595.28 - $this->getStringWidth($metaStr, 9.5)) / 2;
            $stream .= "1 0 0 1 " . number_format($metaX, 2, '.', '') . " 640 Tm\n";
            $stream .= "(" . $this->escape($metaStr) . ") Tj\n";

            // Student Information
            $stream .= "0.09 0.17 0.35 rg\n";
            $stream .= "/F2 10 Tf\n";
            $stream .= "1 0 0 1 50 618 Tm\n";
            $stream .= "(STUDENT INFORMATION) Tj\n";

            // Student Grid Row 1
            $stream .= "0.3 0.3 0.3 rg\n";
            $stream .= "/F2 9 Tf\n";
            $stream .= "1 0 0 1 60 590 Tm\n";
            $stream .= "(Student Name:) Tj\n";
            $stream .= "/F1 9 Tf\n";
            $stream .= "1 0 0 1 135 590 Tm\n";
            $stream .= "(" . $this->escape($studentName) . ") Tj\n";

            $stream .= "/F2 9 Tf\n";
            $stream .= "1 0 0 1 310 590 Tm\n";
            $stream .= "(Class & Section:) Tj\n";
            $stream .= "/F1 9 Tf\n";
            $stream .= "1 0 0 1 395 590 Tm\n";
            $stream .= "(" . $this->escape($classSection) . ") Tj\n";

            // Student Grid Row 2
            $stream .= "/F2 9 Tf\n";
            $stream .= "1 0 0 1 60 560 Tm\n";
            $stream .= "(Roll Number:) Tj\n";
            $stream .= "/F1 9 Tf\n";
            $stream .= "1 0 0 1 135 560 Tm\n";
            $stream .= "(" . $this->escape($rollNo) . ") Tj\n";

            $stream .= "/F2 9 Tf\n";
            $stream .= "1 0 0 1 310 560 Tm\n";
            $stream .= "(Admission No:) Tj\n";
            $stream .= "/F1 9 Tf\n";
            $stream .= "1 0 0 1 395 560 Tm\n";
            $stream .= "(" . $this->escape($admissionNo) . ") Tj\n";

            // Payment Information
            $stream .= "0.09 0.17 0.35 rg\n";
            $stream .= "/F2 10 Tf\n";
            $stream .= "1 0 0 1 50 508 Tm\n";
            $stream .= "(PAYMENT DETAILS) Tj\n";

            // Payment Grid Row 1
            $stream .= "0.3 0.3 0.3 rg\n";
            $stream .= "/F2 9 Tf\n";
            $stream .= "1 0 0 1 60 480 Tm\n";
            $stream .= "(Mode of Payment:) Tj\n";
            $stream .= "/F1 9 Tf\n";
            $stream .= "1 0 0 1 145 480 Tm\n";
            $stream .= "(" . $this->escape($paymentMode) . ") Tj\n";

            $stream .= "/F2 9 Tf\n";
            $stream .= "1 0 0 1 310 480 Tm\n";
            $stream .= "(Reference Number:) Tj\n";
            $stream .= "/F1 9 Tf\n";
            $stream .= "1 0 0 1 405 480 Tm\n";
            $stream .= "(" . $this->escape($receiptNo) . ") Tj\n";

            // Payment Grid Row 2
            $stream .= "/F2 9 Tf\n";
            $stream .= "1 0 0 1 60 450 Tm\n";
            $stream .= "(Payment Date:) Tj\n";
            $stream .= "/F1 9 Tf\n";
            $stream .= "1 0 0 1 145 450 Tm\n";
            $stream .= "(" . $this->escape($paymentDate) . ") Tj\n";

            $descLabel = isset($fields['Month']) ? "Month:" : (isset($fields['Months']) ? "Months:" : (isset($fields['Description']) ? "Description:" : ((count($rawMonths) > 1) ? "Billing Months:" : "Billing Month:")));
            $stream .= "/F2 9 Tf\n";
            $stream .= "1 0 0 1 310 450 Tm\n";
            $stream .= "(" . $this->escape($descLabel) . ") Tj\n";

            $stream .= "/F1 9 Tf\n";
            $currY = 450;
            foreach ($monthLines as $mLine) {
                $stream .= "1 0 0 1 405 " . $currY . " Tm\n";
                $stream .= "(" . $this->escape($mLine) . ") Tj\n";
                $currY -= 14;
            }

            // Amount Box Text Label
            $amtLabelY = 375 - $extraShift;
            $stream .= "0.09 0.17 0.35 rg\n";
            $stream .= "/F2 9.5 Tf\n";
            $amtLabelX = $amtX + (220 - (strlen("TOTAL AMOUNT PAID") * 5.2)) / 2;
            $stream .= "1 0 0 1 " . number_format($amtLabelX, 2, '.', '') . " " . $amtLabelY . " Tm\n";
            $stream .= "(TOTAL AMOUNT PAID) Tj\n";

            // Draw Amount Value text formatted as "Rs X,XXX" on one centered line
            $amtValY = 345 - $extraShift;
            $displayText = "Rs " . $amountPaid;
            $textWidth = $this->getStringWidth($displayText, 18);
            $amtValX = $amtX + (220 - $textWidth) / 2;

            $stream .= "0.09 0.17 0.35 rg\n";
            $stream .= "/F2 18 Tf\n";
            $stream .= "1 0 0 1 " . number_format($amtValX, 2, '.', '') . " " . $amtValY . " Tm\n";
            $stream .= "(" . $this->escape($displayText) . ") Tj\n";
            $stream .= "ET\n";

            // Footer
            $footY1 = 120 - $extraShift;
            $footY2 = 100 - $extraShift;
            $stream .= "0.5 0.5 0.5 rg\n";
            $stream .= "/F1 8.5 Tf\n";
            
            $foot1 = "This is a computer-generated fee receipt. No signature is required.";
            $foot1X = (595.28 - $this->getStringWidth($foot1, 8.5)) / 2;
            $stream .= "1 0 0 1 " . number_format($foot1X, 2, '.', '') . " " . $footY1 . " Tm\n";
            $stream .= "(" . $foot1 . ") Tj\n";

            $foot2 = "Thank you for your payment.";
            $foot2X = (595.28 - $this->getStringWidth($foot2, 8.5)) / 2;
            $stream .= "1 0 0 1 " . number_format($foot2X, 2, '.', '') . " " . $footY2 . " Tm\n";
            $stream .= "(" . $foot2 . ") Tj\n";

            $stream .= "ET";
        } elseif ($isSalarySlip) {
            // =========================================================================
            // REDESIGNED SALARY SLIP
            // =========================================================================
            $schoolName = strtoupper(trim($fields['School'] ?? 'SHIKSHA PILOT SCHOOL'));
            $slipTitle = "SALARY DISBURSEMENT SLIP";
            
            $staffName = $fields['Employee Name'] ?? '—';
            $employeeId = $fields['Employee ID'] ?? '—';
            $salaryMonth = $fields['Month'] ?? '—';
            $amountDisbursed = $fields['Amount Disbursed'] ?? '—';
            $disbursedDate = $fields['Disbursed Date'] ?? '—';
            $statusVal = $fields['Status'] ?? 'PAID';

            // Draw Graphics elements
            $stream .= "0.85 0.85 0.85 RG\n";
            $stream .= "0.75 w\n";
            $stream .= "45 45 505.28 751.89 re\n";
            $stream .= "S\n";

            // Draw Logo image if loaded
            if ($logoObjId > 0 && !empty($imgStream)) {
                $logoX = (595.28 - $logoWidth) / 2;
                $stream .= "q\n";
                $stream .= "{$logoWidth} 0 0 {$logoHeight} " . number_format($logoX, 2, '.', '') . " 735 cm\n";
                $stream .= "/Img1 Do\n";
                $stream .= "Q\n";
            }

            // Divider line below header/logo
            $stream .= "0.09 0.17 0.35 RG\n";
            $stream .= "0.75 w\n";
            $stream .= "50 655 m 545.28 655 l S\n";

            $stream .= "0.88 0.90 0.94 RG\n";
            $stream .= "0.5 w\n";
            $stream .= "45 545 505.28 65 re\n";
            $stream .= "S\n";

            // Centered amount box
            $stream .= "0.92 0.94 0.98 rg\n";
            $amtX = (595.28 - 220) / 2;
            $stream .= "{$amtX} 365 220 80 re\n";
            $stream .= "f\n";
            $stream .= "0.70 0.78 0.92 RG\n";
            $stream .= "1 w\n";
            $stream .= "{$amtX} 365 220 80 re\n";
            $stream .= "S\n";

            // Draw Text elements
            $stream .= "BT\n";

            // School Name (Centered)
            $stream .= "0.09 0.17 0.35 rg\n";
            $stream .= "/F2 18 Tf\n";
            $schNameX = (595.28 - $this->getStringWidth($schoolName, 18)) / 2;
            $stream .= "1 0 0 1 " . number_format($schNameX, 2, '.', '') . " 700 Tm\n";
            $stream .= "(" . $this->escape($schoolName) . ") Tj\n";

            // Title (Centered)
            $stream .= "/F2 11 Tf\n";
            $stream .= "0.3 0.3 0.3 rg\n";
            $titleX = (595.28 - $this->getStringWidth($slipTitle, 11)) / 2;
            $stream .= "1 0 0 1 " . number_format($titleX, 2, '.', '') . " 680 Tm\n";
            $stream .= "(" . $this->escape($slipTitle) . ") Tj\n";

            // Month / Date Subtitle (Centered)
            $stream .= "/F1 9 Tf\n";
            $stream .= "0.4 0.4 0.4 rg\n";
            $metaStr = "Month: {$salaryMonth}   |   Date: {$disbursedDate}";
            $metaX = (595.28 - $this->getStringWidth($metaStr, 9)) / 2;
            $stream .= "1 0 0 1 " . number_format($metaX, 2, '.', '') . " 663 Tm\n";
            $stream .= "(" . $this->escape($metaStr) . ") Tj\n";

            // Employee Information Section
            $stream .= "0.09 0.17 0.35 rg\n";
            $stream .= "/F2 10 Tf\n";
            $stream .= "1 0 0 1 50 618 Tm\n";
            $stream .= "(EMPLOYEE INFORMATION) Tj\n";

            $stream .= "0.3 0.3 0.3 rg\n";
            $stream .= "/F2 9 Tf\n";
            $stream .= "1 0 0 1 60 590 Tm\n";
            $stream .= "(Employee Name:) Tj\n";
            $stream .= "/F1 9 Tf\n";
            $stream .= "1 0 0 1 145 590 Tm\n";
            $stream .= "(" . $this->escape($staffName) . ") Tj\n";

            $stream .= "/F2 9 Tf\n";
            $stream .= "1 0 0 1 310 590 Tm\n";
            $stream .= "(Disbursement Month:) Tj\n";
            $stream .= "/F1 9 Tf\n";
            $stream .= "1 0 0 1 420 590 Tm\n";
            $stream .= "(" . $this->escape($salaryMonth) . ") Tj\n";

            $stream .= "/F2 9 Tf\n";
            $stream .= "1 0 0 1 60 560 Tm\n";
            $stream .= "(Employee ID:) Tj\n";
            $stream .= "/F1 9 Tf\n";
            $stream .= "1 0 0 1 145 560 Tm\n";
            $stream .= "(" . $this->escape($employeeId) . ") Tj\n";

            $stream .= "/F2 9 Tf\n";
            $stream .= "1 0 0 1 310 560 Tm\n";
            $stream .= "(Status:) Tj\n";
            $stream .= "/F1 9 Tf\n";
            $stream .= "1 0 0 1 420 560 Tm\n";
            $stream .= "(" . $statusVal . ") Tj\n";

            // Amount Box Text (100% Centered inside Box)
            $amtLabelStr = "TOTAL AMOUNT DISBURSED";
            $stream .= "0.09 0.17 0.35 rg\n";
            $stream .= "/F2 9.5 Tf\n";
            $amtLabelX = $amtX + (220 - $this->getStringWidth($amtLabelStr, 9.5)) / 2;
            $stream .= "1 0 0 1 " . number_format($amtLabelX, 2, '.', '') . " 423 Tm\n";
            $stream .= "(" . $amtLabelStr . ") Tj\n";

            $stream .= "0.09 0.17 0.35 rg\n";
            $stream .= "/F2 18 Tf\n";
            $amtValX = $amtX + (220 - $this->getStringWidth($amountDisbursed, 18)) / 2;
            $stream .= "1 0 0 1 " . number_format($amtValX, 2, '.', '') . " 393 Tm\n";
            $stream .= "(" . $this->escape($amountDisbursed) . ") Tj\n";

            // Footer (Centered Disclaimer, No Powered By)
            $stream .= "0.5 0.5 0.5 rg\n";
            $stream .= "/F1 8.5 Tf\n";
            
            $foot1 = "This is a computer-generated salary slip. No signature is required.";
            $foot1X = (595.28 - $this->getStringWidth($foot1, 8.5)) / 2;
            $stream .= "1 0 0 1 " . number_format($foot1X, 2, '.', '') . " 120 Tm\n";
            $stream .= "(" . $foot1 . ") Tj\n";

            $stream .= "ET";
        } else {
            // =========================================================================
            // STANDARD / BACKWARD-COMPATIBLE SIMPLE TEXT FALLBACK
            // =========================================================================
            $stream .= "BT\n";
            
            $titleWidth = strlen($title) * 8.5;
            $titleX = max(20.0, (595.28 - $titleWidth) / 2.0);
            $stream .= "/F2 18 Tf\n";
            $stream .= "1 0 0 1 " . number_format($titleX, 2, '.', '') . " 780 Tm\n";
            $stream .= "(" . $this->escape($title) . ") Tj\n";

            $y = 740.0;
            foreach ($lines as $line) {
                if ($line === '---') {
                    $divider = "--------------------------------------------------------";
                    $lineWidth = strlen($divider) * 5.5;
                    $lineX = max(20.0, (595.28 - $lineWidth) / 2.0);
                    $stream .= "/F1 11 Tf\n";
                    $stream .= "1 0 0 1 " . number_format($lineX, 2, '.', '') . " " . number_format($y, 2, '.', '') . " Tm\n";
                    $stream .= "(" . $divider . ") Tj\n";
                    $y -= 15.0;
                } else {
                    $lineWidth = strlen($line) * 5.5;
                    $lineX = max(20.0, (595.28 - $lineWidth) / 2.0);
                    $stream .= "/F1 11 Tf\n";
                    $stream .= "1 0 0 1 " . number_format($lineX, 2, '.', '') . " " . number_format($y, 2, '.', '') . " Tm\n";
                    $stream .= "(" . $this->escape($line) . ") Tj\n";
                    $y -= 20.0;
                }
            }
            $stream .= "ET";
        }

        // Obj 4: Contents
        $this->obj(4);
        $this->write("<< /Length " . strlen($stream) . " >>");
        $this->write("stream");
        $this->write($stream);
        $this->write("endstream");
        $this->endobj();

        // Write Image Object if present (Obj 5)
        if ($logoObjId > 0 && !empty($imgStream)) {
            $this->obj($logoObjId);
            $filter = $this->isPng ? '/FlateDecode' : '/DCTDecode';
            $smaskStr = $this->hasSMask ? " /SMask 6 0 R" : "";
            $this->write("<< /Type /XObject /Subtype /Image /Width {$this->logoPixelWidth} /Height {$this->logoPixelHeight} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter {$filter}{$smaskStr} /Length " . strlen($imgStream) . " >>");
            $this->write("stream");
            $this->buffer .= $imgStream;
            $this->write("\nendstream");
            $this->endobj();
        }

        // Write SMask Object if present (Obj 6)
        if ($this->hasSMask && !empty($this->smaskStream)) {
            $this->obj(6);
            $this->write("<< /Type /XObject /Subtype /Image /Width {$this->logoPixelWidth} /Height {$this->logoPixelHeight} /ColorSpace /DeviceGray /BitsPerComponent 8 /Filter /FlateDecode /Length " . strlen($this->smaskStream) . " >>");
            $this->write("stream");
            $this->buffer .= $this->smaskStream;
            $this->write("\nendstream");
            $this->endobj();
        }

        // Cross-reference table
        $xref_pos = strlen($this->buffer);
        $maxObj = $this->hasSMask ? 6 : ($logoObjId > 0 ? 5 : 4);
        $this->write("xref");
        $this->write("0 " . ($maxObj + 1));
        $this->write("0000000000 65535 f ");
        for ($i = 1; $i <= $maxObj; $i++) {
            $this->write(sprintf("%010d 00000 n ", $this->offsets[$i]));
        }

        $this->write("trailer");
        $this->write("<< /Size " . ($maxObj + 1) . " /Root 1 0 R >>");
        $this->write("startxref");
        $this->write((string)$xref_pos);
        $this->write("%%EOF");
        $this->write("0 " . ($maxObj + 1));
        $this->write("0000000000 65535 f ");
        for ($i = 1; $i <= $maxObj; $i++) {
            $this->write(sprintf("%010d 00000 n ", $this->offsets[$i]));
        }

        $this->write("trailer");
        $this->write("<< /Size " . ($maxObj + 1) . " /Root 1 0 R >>");
        $this->write("startxref");
        $this->write((string)$xref_pos);
        $this->write("%%EOF");

        return $this->buffer;
    }

    private function parsePng(string $data): ?array
    {
        if (substr($data, 0, 8) !== "\x89PNG\r\n\x1a\n") {
            return null;
        }
        $offset = 8;
        $len = strlen($data);
        $ihdr = null;
        $idat = '';
        $palette = '';
        $trns = '';
        while ($offset < $len) {
            $chunkLenArr = unpack('N', substr($data, $offset, 4));
            if (!$chunkLenArr) break;
            $chunkLen = $chunkLenArr[1];
            $chunkType = substr($data, $offset + 4, 4);
            $chunkData = substr($data, $offset + 8, $chunkLen);
            $offset += 12 + $chunkLen;
            if ($chunkType === 'IHDR') {
                $ihdr = unpack('Nwidth/Nheight/Cdepth/Ccolor/Ccomp/Cfilter/Cinterlace', $chunkData);
            } elseif ($chunkType === 'IDAT') {
                $idat .= $chunkData;
            } elseif ($chunkType === 'PLTE') {
                $palette = $chunkData;
            } elseif ($chunkType === 'tRNS') {
                $trns = $chunkData;
            } elseif ($chunkType === 'IEND') {
                break;
            }
        }
        if (!$ihdr || empty($idat)) {
            return null;
        }
        if ($ihdr['depth'] !== 8 || $ihdr['comp'] !== 0 || $ihdr['filter'] !== 0 || $ihdr['interlace'] !== 0) {
            return null;
        }
        
        $decompressed = @gzuncompress($idat);
        if ($decompressed === false) {
            return null;
        }
        
        $w = $ihdr['width'];
        $h = $ihdr['height'];
        $colorType = $ihdr['color'];
        
        if ($colorType !== 2 && $colorType !== 3 && $colorType !== 6) {
            return null;
        }
        if ($colorType === 3 && empty($palette)) {
            return null;
        }
        
        $bpp = 3;
        if ($colorType === 3) {
            $bpp = 1;
        } elseif ($colorType === 6) {
            $bpp = 4;
        }
        
        $rowLen = 1 + $w * $bpp;
        $pixels = '';
        $alphas = '';
        $prevRow = array_fill(0, $w * $bpp, 0);
        
        for ($y = 0; $y < $h; $y++) {
            $rowStart = $y * $rowLen;
            if ($rowStart >= strlen($decompressed)) break;
            $filter = ord($decompressed[$rowStart]);
            $rowBytes = substr($decompressed, $rowStart + 1, $w * $bpp);
            $currentRow = [];
            
            for ($i = 0; $i < $w * $bpp; $i++) {
                $raw = ord($rowBytes[$i] ?? "\x00");
                $left = ($i >= $bpp) ? $currentRow[$i - $bpp] : 0;
                $up = $prevRow[$i] ?? 0;
                $leftUp = ($i >= $bpp) ? ($prevRow[$i - $bpp] ?? 0) : 0;
                
                $val = 0;
                switch ($filter) {
                    case 0: $val = $raw; break;
                    case 1: $val = ($raw + $left) & 255; break;
                    case 2: $val = ($raw + $up) & 255; break;
                    case 3: $val = ($raw + (int)(($left + $up) / 2)) & 255; break;
                    case 4:
                        $p = $left + $up - $leftUp;
                        $pa = abs($p - $left);
                        $pb = abs($p - $up);
                        $pc = abs($p - $leftUp);
                        if ($pa <= $pb && $pa <= $pc) {
                            $pVal = $left;
                        } elseif ($pb <= $pc) {
                            $pVal = $up;
                        } else {
                            $pVal = $leftUp;
                        }
                        $val = ($raw + $pVal) & 255;
                        break;
                }
                $currentRow[$i] = $val;
            }
            
            if ($colorType === 3) {
                for ($x = 0; $x < $w; $x++) {
                    $idx = $currentRow[$x];
                    $r = ord($palette[$idx * 3] ?? "\x00");
                    $g = ord($palette[$idx * 3 + 1] ?? "\x00");
                    $b = ord($palette[$idx * 3 + 2] ?? "\x00");
                    $pixels .= chr($r) . chr($g) . chr($b);
                    if ($trns !== '') {
                        $alphas .= $trns[$idx] ?? "\xFF";
                    }
                }
            } elseif ($colorType === 6) {
                for ($x = 0; $x < $w; $x++) {
                    $px = $x * $bpp;
                    $pixels .= chr($currentRow[$px] ?? 0) . chr($currentRow[$px + 1] ?? 0) . chr($currentRow[$px + 2] ?? 0);
                    $alphas .= chr($currentRow[$px + 3] ?? 255);
                }
            } else {
                for ($x = 0; $x < $w; $x++) {
                    $px = $x * $bpp;
                    $pixels .= chr($currentRow[$px] ?? 0) . chr($currentRow[$px + 1] ?? 0) . chr($currentRow[$px + 2] ?? 0);
                }
            }
            $prevRow = $currentRow;
        }
        
        $smask = null;
        if ($alphas !== '') {
            $hasTrans = false;
            $lenAlphas = strlen($alphas);
            for ($k = 0; $k < $lenAlphas; $k++) {
                if (ord($alphas[$k]) < 255) {
                    $hasTrans = true;
                    break;
                }
            }
            if ($hasTrans) {
                $smask = gzcompress($alphas);
            }
        }
        
        return [
            'width' => $w,
            'height' => $h,
            'data' => gzcompress($pixels),
            'smask' => $smask
        ];
    }

    private function getStringWidth(string $str, float $fontSize): float
    {
        static $widths = [
            ' ' => 278, '!' => 278, '"' => 355, '#' => 556, '$' => 556, '%' => 889, '&' => 667, '\'' => 191,
            '(' => 333, ')' => 333, '*' => 389, '+' => 584, ',' => 278, '-' => 333, '.' => 278, '/' => 278,
            '0' => 556, '1' => 556, '2' => 556, '3' => 556, '4' => 556, '5' => 556, '6' => 556, '7' => 556,
            '8' => 556, '9' => 556, ':' => 278, ';' => 278, '<' => 584, '=' => 584, '>' => 584, '?' => 556,
            '@' => 1015, 'A' => 667, 'B' => 667, 'C' => 722, 'D' => 722, 'E' => 667, 'F' => 611, 'G' => 778,
            'H' => 722, 'I' => 278, 'J' => 500, 'K' => 667, 'L' => 556, 'M' => 833, 'N' => 722, 'O' => 778,
            'P' => 667, 'Q' => 778, 'R' => 722, 'S' => 667, 'T' => 611, 'U' => 722, 'V' => 667, 'W' => 944,
            'X' => 667, 'Y' => 667, 'Z' => 611, '[' => 333, '\\' => 278, ']' => 333, '^' => 584, '_' => 500,
            '`' => 333, 'a' => 556, 'b' => 556, 'c' => 500, 'd' => 556, 'e' => 556, 'f' => 278, 'g' => 556,
            'h' => 556, 'i' => 222, 'j' => 222, 'k' => 500, 'l' => 222, 'm' => 833, 'n' => 556, 'o' => 556,
            'p' => 556, 'q' => 556, 'r' => 333, 's' => 500, 't' => 278, 'u' => 556, 'v' => 500, 'w' => 722,
            'x' => 500, 'y' => 500, 'z' => 500, '{' => 389, '|' => 278, '}' => 389, '~' => 584
        ];
        $width = 0;
        $len = strlen($str);
        for ($i = 0; $i < $len; $i++) {
            $char = $str[$i];
            $width += $widths[$char] ?? 556;
        }
        return ($width * $fontSize) / 1000;
    }

    private function escape(string $str): string
    {
        return str_replace(['(', ')', '\\'], ['\\(', '\\)', '\\\\'], $str);
    }
}
