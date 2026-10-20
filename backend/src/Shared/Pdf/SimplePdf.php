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

                        $maxW = $isSalarySlip ? 42 : 138;
                        $maxH = $isSalarySlip ? 42 : 52;
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

            $hasDiscount = !empty($fields['Discount']);
            $payableText = $fields['Payable Amount'] ?? null;
            $discountText = $fields['Discount'] ?? null;

            $amtBoxHeight = ($hasDiscount && $payableText && $discountText) ? 100 : 80;
            $amtBoxTop = 400 - $extraShift;
            $amtBoxBottom = $amtBoxTop - $amtBoxHeight;

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

            if ($hasDiscount && $payableText && $discountText) {
                // Payable Amount Line
                $pLineY = $amtBoxTop - 18;
                $stream .= "0.4 0.4 0.4 rg\n";
                $stream .= "/F2 8.5 Tf\n";
                $stream .= "1 0 0 1 " . (187.64 + 15) . " " . $pLineY . " Tm\n";
                $stream .= "(Payable Amount:) Tj\n";
                $stream .= "/F1 8.5 Tf\n";
                $pValStr = (str_starts_with($payableText, 'Rs') || str_starts_with($payableText, '₹')) ? $payableText : "Rs " . $payableText;
                $stream .= "1 0 0 1 " . (407.64 - 15 - $this->getStringWidth($pValStr, 8.5)) . " " . $pLineY . " Tm\n";
                $stream .= "(" . $this->escape($pValStr) . ") Tj\n";

                // Discount Line
                $dLineY = $amtBoxTop - 32;
                $stream .= "0.10 0.55 0.30 rg\n"; // Emerald Green
                $stream .= "/F2 8.5 Tf\n";
                $stream .= "1 0 0 1 " . (187.64 + 15) . " " . $dLineY . " Tm\n";
                $stream .= "(Discount:) Tj\n";
                $dValStr = (str_starts_with($discountText, 'Rs') || str_starts_with($discountText, '₹')) ? "- " . $discountText : "- Rs " . $discountText;
                $stream .= "1 0 0 1 " . (407.64 - 15 - $this->getStringWidth($dValStr, 8.5)) . " " . $dLineY . " Tm\n";
                $stream .= "(" . $this->escape($dValStr) . ") Tj\n";

                // Dashed separator line
                $sepY = $amtBoxTop - 42;
                $stream .= "ET\n";
                $stream .= "0.85 0.85 0.85 RG\n";
                $stream .= "0.5 w\n";
                $stream .= "[2 2] 0 d\n";
                $stream .= (187.64 + 10) . " " . $sepY . " m " . (407.64 - 10) . " " . $sepY . " l S\n";
                $stream .= "[] 0 d\n";
                $stream .= "BT\n";

                $amtLabelY = $amtBoxTop - 58;
                $amtValY = $amtBoxTop - 80;
            } else {
                $amtLabelY = 375 - $extraShift;
                $amtValY = 345 - $extraShift;
            }

            // Amount Box Text Label
            $stream .= "0.09 0.17 0.35 rg\n";
            $stream .= "/F2 9.5 Tf\n";
            $amtLabelX = $amtX + (220 - (strlen("TOTAL AMOUNT PAID") * 5.2)) / 2;
            $stream .= "1 0 0 1 " . number_format($amtLabelX, 2, '.', '') . " " . $amtLabelY . " Tm\n";
            $stream .= "(TOTAL AMOUNT PAID) Tj\n";

            // Draw Amount Value text formatted as "Rs X,XXX" on one centered line
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
            // SALARY SLIP (EXACT 1:1 REPLICA OF WEB PORTAL SALARY SLIP)
            // =========================================================================
            $schoolName = strtoupper(trim($fields['School'] ?? 'ABC PUBLIC SCHOOL'));
            $staffName = $fields['Employee Name'] ?? '—';
            $employeeId = $fields['Employee ID'] ?? '—';
            $designation = $fields['Designation'] ?? 'Teacher';
            $department = $fields['Department'] ?? 'General';
            $academicYear = $fields['Academic Year'] ?? '';
            $salaryMonth = $fields['Payment Month'] ?? ($fields['Month'] ?? '—');
            $titleMonth = strtoupper(trim($fields['Month'] ?? $salaryMonth));

            $amountDisbursed = $fields['Amount Disbursed'] ?? '0.00';
            $disbursedDate = $fields['Payment Date'] ?? ($fields['Disbursed Date'] ?? '—');
            $txnId = $fields['Transaction ID'] ?? '—';

            $baseSalary = $fields['Base Salary'] ?? $amountDisbursed;
            $totalDays = $fields['Total Days'] ?? '—';
            $paidDays = $fields['Paid Days'] ?? '—';
            $presentDays = $fields['Present Days'] ?? '0 Days';
            $paidLeaves = $fields['Paid Leaves'] ?? '0 Day(s)';
            $unpaidLeaves = $fields['Unpaid Leaves'] ?? '0 Day(s)';
            $sundaysHolidays = $fields['Sundays & Holidays'] ?? '0 Days';
            $absentDays = $fields['Absent Days'] ?? '0 Days';
            $absentDates = $fields['Absent Dates'] ?? 'None';
            $unpaidLeaveDates = $fields['Unpaid Leave Dates'] ?? 'None';
            $paidLeaveDates = $fields['Paid Leave Dates'] ?? 'None';
            $allUnpaidDates = $fields['All Unpaid Dates'] ?? $absentDates;
            $attDeduction = $fields['Attendance Deduction'] ?? '0.00';
            $lateDeduction = $fields['Late Penalty Deduction'] ?? '0.00';

            $absentCount = (int)filter_var($absentDays, FILTER_SANITIZE_NUMBER_INT);
            $unpaidLeaveCount = (int)filter_var($unpaidLeaves, FILTER_SANITIZE_NUMBER_INT);
            $paidLeaveCount = (int)filter_var($paidLeaves, FILTER_SANITIZE_NUMBER_INT);
            $totalDeductedDays = $absentCount + $unpaidLeaveCount;
            $hasLateDeduction = !empty($lateDeduction) && !in_array($lateDeduction, ['INR 0.00', '0.00', '0']);

            // Safe formatting using "Rs." to avoid Unicode symbol corruption
            $numBase = (float)str_replace([',', 'INR', 'Rs.'], '', (string)$baseSalary);
            $numDeduct = (float)str_replace([',', 'INR', 'Rs.'], '', (string)$attDeduction);
            $numDisbursed = (float)str_replace([',', 'INR', 'Rs.'], '', (string)$amountDisbursed);
            $numLate = (float)str_replace([',', 'INR', 'Rs.'], '', (string)$lateDeduction);

            $fmtBase = 'Rs. ' . number_format($numBase, 2);
            $fmtDeduct = '- Rs. ' . number_format($numDeduct, 2);
            $fmtDisbursed = 'Rs. ' . number_format($numDisbursed, 2);
            $fmtLate = '- Rs. ' . number_format($numLate, 2);

            // Deduction description matching Web
            if ($unpaidLeaveCount > 0 && $absentCount > 0) {
                $deductLabel = "Attendance & Unpaid Leave Deduction ({$absentCount} Absent + {$unpaidLeaveCount} Unpaid Leave = {$totalDeductedDays} Days)";
            } elseif ($unpaidLeaveCount > 0) {
                $deductLabel = "Unpaid Leave Deduction ({$unpaidLeaveCount} Excess Leave Day(s))";
            } else {
                $deductLabel = "Attendance Deduction ({$totalDeductedDays} Absent Days)";
            }

            // Word wrap helper for callout dates
            $wrapDates = function(string $text, int $maxLen = 80): array {
                $text = trim($text);
                if (empty($text) || $text === 'None') return [];
                if (strlen($text) <= $maxLen) return [$text];
                $result = [];
                while (strlen($text) > $maxLen) {
                    $cut = strrpos(substr($text, 0, $maxLen), ',');
                    if ($cut === false) {
                        $cut = strrpos(substr($text, 0, $maxLen), ' ');
                    }
                    if ($cut === false) {
                        $cut = $maxLen;
                    }
                    $result[] = trim(substr($text, 0, $cut + 1));
                    $text = trim(substr($text, $cut + 1));
                }
                if (!empty($text)) {
                    $result[] = $text;
                }
                return $result;
            };

            // Callout sections calculation
            $calloutSections = [];
            if ($absentCount > 0 && !empty($absentDates) && $absentDates !== 'None') {
                $calloutSections[] = [
                    'title' => "Absent Dates ({$absentCount} Days):",
                    'lines' => $wrapDates($absentDates),
                    'isEmerald' => false
                ];
            }
            if ($unpaidLeaveCount > 0 && !empty($unpaidLeaveDates) && $unpaidLeaveDates !== 'None') {
                $calloutSections[] = [
                    'title' => "Unpaid / Excess Leave Dates ({$unpaidLeaveCount} Days - Exceeding Allowed Quota):",
                    'lines' => $wrapDates($unpaidLeaveDates),
                    'isEmerald' => false
                ];
            }
            if ($paidLeaveCount > 0 && !empty($paidLeaveDates) && $paidLeaveDates !== 'None') {
                $calloutSections[] = [
                    'title' => "Paid Leave Dates ({$paidLeaveCount} Day - Within School Allowed Quota):",
                    'lines' => $wrapDates($paidLeaveDates . " (100% Paid - Added to Total Paid Days)"),
                    'isEmerald' => true
                ];
            }

            $calloutH = 0;
            if (!empty($calloutSections)) {
                $calloutH = 14; // padding
                foreach ($calloutSections as $sec) {
                    $calloutH += 12; // header
                    $calloutH += count($sec['lines']) * 11; // text lines
                    $calloutH += 4; // spacing
                }
            }

            // Attendance Card Height
            $attCardH = 74 + ($calloutH > 0 ? ($calloutH + 10) : 0);
            $attCardY = 598 - $attCardH;

            // Salary Calculation Table Height (2 columns)
            $tableRowsH = 21 + ($totalDeductedDays > 0 ? 21 : 0) + ($hasLateDeduction ? 21 : 0);
            $tableH = 22 + $tableRowsH + 25; // Header + Rows + Net row
            $tableY = $attCardY - 14 - $tableH;

            // Bottom info Y
            $dashY = $tableY - 18;

            // -------------------------------------------------------------------------
            // 1. DRAW GRAPHICS & BOXES
            // -------------------------------------------------------------------------

            // Outer Card Border (Like Web #salary-slip-print-area)
            $stream .= "0.88 0.88 0.90 RG\n";
            $stream .= "0.75 w\n";
            $outerH = 770 - ($dashY - 55);
            $stream .= "45 " . number_format($dashY - 55, 2, '.', '') . " 505.28 " . number_format($outerH, 2, '.', '') . " re\n";
            $stream .= "S\n";

            // Header: Left Logo
            if ($logoObjId > 0 && !empty($imgStream)) {
                $stream .= "q\n";
                $stream .= "{$logoWidth} 0 0 {$logoHeight} 58 720 cm\n";
                $stream .= "/Img1 Do\n";
                $stream .= "Q\n";
            } else {
                // Dark square with white school initial letter
                $stream .= "0.09 0.09 0.11 rg\n";
                $stream .= "58 720 42 42 re\n";
                $stream .= "f\n";
            }

            // Header bottom border (2px dark line)
            $stream .= "0.09 0.09 0.11 RG\n";
            $stream .= "1.5 w\n";
            $stream .= "50 710 m 545.28 710 l S\n";

            // Title double-line underline
            $titleStr = "SALARY SLIP - " . $titleMonth;
            $titleW = $this->getStringWidth($titleStr, 10.5);
            $titleX = (595.28 - $titleW) / 2;
            $stream .= "0.10 0.10 0.12 RG\n";
            $stream .= "0.75 w\n";
            $stream .= number_format($titleX - 6, 2, '.', '') . " 680 m " . number_format($titleX + $titleW + 6, 2, '.', '') . " 680 l S\n";
            $stream .= number_format($titleX - 6, 2, '.', '') . " 677.5 m " . number_format($titleX + $titleW + 6, 2, '.', '') . " 677.5 l S\n";

            // Box 1: Employee Information Card
            $stream .= "0.98 0.98 0.99 rg\n";
            $stream .= "50 612 495.28 54 re\n";
            $stream .= "f\n";
            $stream .= "0.88 0.88 0.90 RG\n";
            $stream .= "0.75 w\n";
            $stream .= "50 612 495.28 54 re\n";
            $stream .= "S\n";

            // Box 2: Attendance Summary Card
            $stream .= "0.98 0.98 0.99 rg\n";
            $stream .= "50 " . $attCardY . " 495.28 " . $attCardH . " re\n";
            $stream .= "f\n";
            $stream .= "0.88 0.88 0.90 RG\n";
            $stream .= "0.75 w\n";
            $stream .= "50 " . $attCardY . " 495.28 " . $attCardH . " re\n";
            $stream .= "S\n";

            // Attendance card top header divider line
            $stream .= "0.88 0.88 0.90 RG\n";
            $stream .= "0.5 w\n";
            $stream .= "50 573 m 545.28 573 l S\n";

            // Attendance card top right badge
            $badgeText = ($totalDeductedDays > 0) ? "{$totalDeductedDays} Unpaid / Absent Days" : "Full Attendance";
            $badgeW = $this->getStringWidth($badgeText, 7.5) + 12;
            $badgeX = 536 - $badgeW;
            if ($totalDeductedDays > 0) {
                $stream .= "0.95 0.95 0.96 rg\n";
                $stream .= number_format($badgeX, 2, '.', '') . " 578 " . number_format($badgeW, 2, '.', '') . " 14 re f\n";
                $stream .= "0.88 0.88 0.90 RG 0.5 w\n";
                $stream .= number_format($badgeX, 2, '.', '') . " 578 " . number_format($badgeW, 2, '.', '') . " 14 re S\n";
            } else {
                $stream .= "0.92 0.98 0.95 rg\n";
                $stream .= number_format($badgeX, 2, '.', '') . " 578 " . number_format($badgeW, 2, '.', '') . " 14 re f\n";
                $stream .= "0.65 0.88 0.75 RG 0.5 w\n";
                $stream .= number_format($badgeX, 2, '.', '') . " 578 " . number_format($badgeW, 2, '.', '') . " 14 re S\n";
            }

            // Attendance Date Callout Box (if applicable)
            if ($calloutH > 0) {
                $calloutBottom = 514 - $calloutH;
                $stream .= "1.0 1.0 1.0 rg\n";
                $stream .= "58 " . $calloutBottom . " 479.28 " . $calloutH . " re f\n";
                $stream .= "0.88 0.88 0.90 RG 0.5 w\n";
                $stream .= "58 " . $calloutBottom . " 479.28 " . $calloutH . " re S\n";
            }

            // Box 3: Salary Calculation Table (2 columns: Description & Amount)
            $stream .= "1.0 1.0 1.0 rg\n";
            $stream .= "50 " . $tableY . " 495.28 " . $tableH . " re f\n";
            $stream .= "0.88 0.88 0.90 RG 0.75 w\n";
            $stream .= "50 " . $tableY . " 495.28 " . $tableH . " re S\n";

            // Table Header row (bg-zinc-100)
            $thY = $tableY + $tableH - 22;
            $stream .= "0.95 0.95 0.96 rg\n";
            $stream .= "50 " . $thY . " 495.28 22 re f\n";
            $stream .= "0.88 0.88 0.90 RG 0.5 w\n";
            $stream .= "50 " . $thY . " m 545.28 " . $thY . " l S\n";

            // Row 1 divider
            $currRowY = $thY - 21;
            $stream .= "0.92 0.92 0.94 RG 0.5 w\n";
            $stream .= "50 " . $currRowY . " m 545.28 " . $currRowY . " l S\n";

            // Row 2 (if deduction exists)
            if ($totalDeductedDays > 0) {
                $stream .= "0.985 0.985 0.99 rg\n";
                $stream .= "50 " . ($currRowY - 21) . " 495.28 21 re f\n";
                $currRowY -= 21;
                $stream .= "0.92 0.92 0.94 RG 0.5 w\n";
                $stream .= "50 " . $currRowY . " m 545.28 " . $currRowY . " l S\n";
            }

            // Row 3 (if late deduction exists)
            if ($hasLateDeduction) {
                $currRowY -= 21;
                $stream .= "0.92 0.92 0.94 RG 0.5 w\n";
                $stream .= "50 " . $currRowY . " m 545.28 " . $currRowY . " l S\n";
            }

            // Net Disbursed Row (bg-zinc-50 with top border-t-2)
            $stream .= "0.975 0.975 0.985 rg\n";
            $stream .= "50 " . $tableY . " 495.28 25 re f\n";
            $stream .= "0.85 0.85 0.88 RG 1.2 w\n";
            $stream .= "50 " . ($tableY + 25) . " m 545.28 " . ($tableY + 25) . " l S\n";

            // Dashed Divider Line for Footer
            $stream .= "[3 3] 0 d\n";
            $stream .= "0.85 0.85 0.88 RG 0.75 w\n";
            $stream .= "50 " . $dashY . " m 545.28 " . $dashY . " l S\n";
            $stream .= "[] 0 d\n";

            // -------------------------------------------------------------------------
            // 2. DRAW TEXT ELEMENTS
            // -------------------------------------------------------------------------
            $stream .= "BT\n";

            // Header: Initial letter if no logo image
            if (!($logoObjId > 0 && !empty($imgStream))) {
                $initial = !empty($schoolName) ? substr($schoolName, 0, 1) : 'S';
                $stream .= "1 1 1 rg /F2 20 Tf 1 0 0 1 72 733 Tm (" . $this->escape($initial) . ") Tj\n";
            }

            // Header: School Name & Subtitle
            $stream .= "0.09 0.09 0.11 rg /F2 13.5 Tf 1 0 0 1 112 745 Tm (" . $this->escape($schoolName) . ") Tj\n";
            $stream .= "0.45 0.45 0.48 rg /F2 8.5 Tf 1 0 0 1 112 731 Tm (TEACHER PAYOUT PAYSLIP) Tj\n";

            // Centered Title
            $stream .= "0.10 0.10 0.12 rg /F2 10.5 Tf\n";
            $stream .= "1 0 0 1 " . number_format($titleX, 2, '.', '') . " 686 Tm (" . $this->escape($titleStr) . ") Tj\n";

            // Box 1: Employee Information
            // Col 1
            $stream .= "0.45 0.45 0.48 rg /F1 8 Tf 1 0 0 1 64 650 Tm (Teacher Name:) Tj\n";
            $stream .= "0.09 0.09 0.11 rg /F2 9.5 Tf 1 0 0 1 64 639 Tm (" . $this->escape($staffName) . ") Tj\n";
            $stream .= "0.45 0.45 0.48 rg /F1 8 Tf 1 0 0 1 64 626 Tm (Designation / Subject:) Tj\n";
            $designationFull = $designation . " · " . $department;
            $stream .= "0.09 0.09 0.11 rg /F2 8.5 Tf 1 0 0 1 64 616 Tm (" . $this->escape($designationFull) . ") Tj\n";

            // Col 2
            $stream .= "0.45 0.45 0.48 rg /F1 8 Tf 1 0 0 1 310 650 Tm (Employee ID:) Tj\n";
            $stream .= "0.09 0.09 0.11 rg /F2 9.5 Tf 1 0 0 1 310 639 Tm (" . $this->escape($employeeId) . ") Tj\n";
            $stream .= "0.45 0.45 0.48 rg /F1 8 Tf 1 0 0 1 310 626 Tm (Academic Year:) Tj\n";
            $stream .= "0.09 0.09 0.11 rg /F2 8.5 Tf 1 0 0 1 310 616 Tm (" . $this->escape($academicYear) . ") Tj\n";

            // Box 2: Attendance Summary Header
            $stream .= "0.10 0.10 0.12 rg /F2 8.5 Tf 1 0 0 1 64 581 Tm (ATTENDANCE SUMMARY (" . $this->escape(strtoupper($salaryMonth)) . ")) Tj\n";

            // Attendance Pill Badge Text
            if ($totalDeductedDays > 0) {
                $stream .= "0.20 0.20 0.22 rg /F2 7.5 Tf\n";
            } else {
                $stream .= "0.04 0.47 0.34 rg /F2 7.5 Tf\n";
            }
            $stream .= "1 0 0 1 " . number_format($badgeX + 6, 2, '.', '') . " 582 Tm (" . $this->escape($badgeText) . ") Tj\n";

            // Attendance Stats Grid
            // Row 1
            $stream .= "0.45 0.45 0.48 rg /F1 7.5 Tf 1 0 0 1 64 560 Tm (Total Days:) Tj\n";
            $stream .= "0.10 0.10 0.12 rg /F2 8.5 Tf 1 0 0 1 64 550 Tm (" . $this->escape($totalDays) . ") Tj\n";

            $stream .= "0.45 0.45 0.48 rg /F1 7.5 Tf 1 0 0 1 180 560 Tm (Present Days:) Tj\n";
            $stream .= "0.10 0.10 0.12 rg /F2 8.5 Tf 1 0 0 1 180 550 Tm (" . $this->escape($presentDays) . ") Tj\n";

            $stream .= "0.45 0.45 0.48 rg /F1 7.5 Tf 1 0 0 1 295 560 Tm (Sundays & Holidays:) Tj\n";
            $stream .= "0.10 0.10 0.12 rg /F2 8.5 Tf 1 0 0 1 295 550 Tm (" . $this->escape($sundaysHolidays) . ") Tj\n";

            $stream .= "0.45 0.45 0.48 rg /F1 7.5 Tf 1 0 0 1 430 560 Tm (Total Paid Days:) Tj\n";
            $stream .= "0.04 0.47 0.34 rg /F2 8.5 Tf 1 0 0 1 430 550 Tm (" . $this->escape($paidDays) . ") Tj\n";

            // Row 2
            $stream .= "0.45 0.45 0.48 rg /F1 7.5 Tf 1 0 0 1 64 537 Tm (Paid Leaves (Allowed):) Tj\n";
            $stream .= "0.10 0.10 0.12 rg /F2 8.5 Tf 1 0 0 1 64 527 Tm (" . $this->escape($paidLeaves) . ") Tj\n";

            $stream .= "0.45 0.45 0.48 rg /F1 7.5 Tf 1 0 0 1 180 537 Tm (Unpaid Leaves (Excess):) Tj\n";
            $stream .= "0.10 0.10 0.12 rg /F2 8.5 Tf 1 0 0 1 180 527 Tm (" . $this->escape($unpaidLeaves) . ") Tj\n";

            $stream .= "0.45 0.45 0.48 rg /F1 7.5 Tf 1 0 0 1 295 537 Tm (Absent Days:) Tj\n";
            $stream .= "0.10 0.10 0.12 rg /F2 8.5 Tf 1 0 0 1 295 527 Tm (" . $this->escape($absentDays) . ") Tj\n";

            // Attendance Callout Dates
            if (!empty($calloutSections)) {
                $curCallY = 504;
                foreach ($calloutSections as $sec) {
                    $stream .= "0.10 0.10 0.12 rg /F2 8 Tf 1 0 0 1 66 " . $curCallY . " Tm (" . $this->escape($sec['title']) . ") Tj\n";
                    $curCallY -= 11;
                    if ($sec['isEmerald']) {
                        $stream .= "0.04 0.47 0.34 rg /F1 7.5 Tf\n";
                    } else {
                        $stream .= "0.25 0.25 0.28 rg /F1 7.5 Tf\n";
                    }
                    foreach ($sec['lines'] as $l) {
                        $stream .= "1 0 0 1 66 " . $curCallY . " Tm (" . $this->escape($l) . ") Tj\n";
                        $curCallY -= 11;
                    }
                    $curCallY -= 3;
                }
            }

            // Box 3: Salary Calculation Table (2 columns)
            // Table Header
            $stream .= "0.30 0.30 0.35 rg /F2 8.5 Tf\n";
            $stream .= "1 0 0 1 64 " . ($thY + 7) . " Tm (Description) Tj\n";
            $amtHeaderX = 530 - $this->getStringWidth("Amount", 8.5);
            $stream .= "1 0 0 1 " . number_format($amtHeaderX, 2, '.', '') . " " . ($thY + 7) . " Tm (Amount) Tj\n";

            // Row 1: Basic Monthly Salary
            $r1Y = $thY - 21;
            $stream .= "0.15 0.15 0.18 rg /F1 8.5 Tf\n";
            $baseLabel = ($totalDeductedDays > 0) ? "Basic Monthly Salary (Full Month)" : "Basic Monthly Salary (Disbursed)";
            $stream .= "1 0 0 1 64 " . ($r1Y + 6) . " Tm (" . $this->escape($baseLabel) . ") Tj\n";
            $stream .= "/F2 8.5 Tf\n";
            $baseValX = 530 - $this->getStringWidth($fmtBase, 8.5);
            $stream .= "1 0 0 1 " . number_format($baseValX, 2, '.', '') . " " . ($r1Y + 6) . " Tm (" . $this->escape($fmtBase) . ") Tj\n";

            // Row 2: Attendance Deduction (if applicable)
            $r2Y = $r1Y - 21;
            if ($totalDeductedDays > 0) {
                $stream .= "0.15 0.15 0.18 rg /F1 8.5 Tf\n";
                $stream .= "1 0 0 1 64 " . ($r2Y + 6) . " Tm (" . $this->escape($deductLabel) . ") Tj\n";
                $stream .= "0.09 0.09 0.11 rg /F2 8.5 Tf\n";
                $deductValX = 530 - $this->getStringWidth($fmtDeduct, 8.5);
                $stream .= "1 0 0 1 " . number_format($deductValX, 2, '.', '') . " " . ($r2Y + 6) . " Tm (" . $this->escape($fmtDeduct) . ") Tj\n";
            }

            // Row 3: Late Penalty Deduction (if applicable)
            if ($hasLateDeduction) {
                $r3Y = $r2Y - 21;
                $stream .= "0.15 0.15 0.18 rg /F1 8.5 Tf\n";
                $stream .= "1 0 0 1 64 " . ($r3Y + 6) . " Tm (Late Penalty Deduction) Tj\n";
                $stream .= "0.09 0.09 0.11 rg /F2 8.5 Tf\n";
                $lateValX = 530 - $this->getStringWidth($fmtLate, 8.5);
                $stream .= "1 0 0 1 " . number_format($lateValX, 2, '.', '') . " " . ($r3Y + 6) . " Tm (" . $this->escape($fmtLate) . ") Tj\n";
            }

            // Net Disbursed Row
            $stream .= "0.09 0.09 0.11 rg /F2 9.5 Tf\n";
            $stream .= "1 0 0 1 64 " . ($tableY + 8) . " Tm (Net Disbursed Amount) Tj\n";
            $stream .= "0.04 0.47 0.34 rg /F2 10.5 Tf\n";
            $netValX = 530 - $this->getStringWidth($fmtDisbursed, 10.5);
            $stream .= "1 0 0 1 " . number_format($netValX, 2, '.', '') . " " . ($tableY + 8) . " Tm (" . $this->escape($fmtDisbursed) . ") Tj\n";

            // Footer Information
            $stream .= "0.45 0.45 0.48 rg /F1 8.5 Tf 1 0 0 1 50 " . ($dashY - 15) . " Tm (Payment Date: ) Tj\n";
            $stream .= "0.12 0.12 0.15 rg /F2 8.5 Tf (" . $this->escape($disbursedDate) . ") Tj\n";

            $stream .= "0.45 0.45 0.48 rg /F1 8.5 Tf 1 0 0 1 50 " . ($dashY - 28) . " Tm (Payment Transaction ID: ) Tj\n";
            $stream .= "0.12 0.12 0.15 rg /F2 8.5 Tf (" . $this->escape($txnId) . ") Tj\n";

            $stream .= "0.55 0.55 0.58 rg /F1 8 Tf 1 0 0 1 50 " . ($dashY - 45) . " Tm (This is a computer-generated salary slip. No signature is required.) Tj\n";

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
        // Replace unicode dashes, dots, quotes, and non-breaking spaces with ASCII equivalents
        $str = str_replace(
            ['–', '—', '−', "\u{2013}", "\u{2014}", "\u{2212}"],
            '-',
            $str
        );
        $str = str_replace(['•', '·', "\u{2022}", "\u{00B7}"], chr(183), $str);
        $str = str_replace(["\u{00A0}", "\u{2009}", "\u{200A}"], ' ', $str);
        $str = str_replace(['‘', '’', "\u{2018}", "\u{2019}"], "'", $str);
        $str = str_replace(['“', '”', "\u{201C}", "\u{201D}"], '"', $str);
        $str = str_replace(['₹', "\u{20B9}"], 'Rs. ', $str);

        // Escape backslash FIRST so that escaped parentheses do not get doubled
        $str = str_replace('\\', '\\\\', $str);
        return str_replace(['(', ')'], ['\\(', '\\)'], $str);
    }
}
