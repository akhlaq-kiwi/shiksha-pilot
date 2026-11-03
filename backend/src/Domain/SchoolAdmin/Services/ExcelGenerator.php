<?php

declare(strict_types=1);

namespace App\Domain\SchoolAdmin\Services;

use ZipArchive;
use RuntimeException;

class ExcelGenerator
{
    public static function generate(array $feeCollections, array $expenses, array $summary): string
    {
        // Construct sheets data
        $sheets = [
            self::buildFeeCollectionSheet($feeCollections),
            self::buildExpensesSheet($expenses),
            self::buildSummarySheet($summary)
        ];

        return self::buildZipXlsx($sheets);
    }

    public static function consolidateFeeCollections(array $feeCollections): array
    {
        $academicMonths = ['April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December', 'January', 'February', 'March'];
        $groups = [];

        foreach ($feeCollections as $item) {
            $rNo = !empty($item['receipt_no']) ? trim((string)$item['receipt_no']) : '';
            $stuId = (int)($item['student_id'] ?? 0);

            // Group by receipt_no + student_id if receipt_no exists, otherwise unique per row
            $groupKey = ($rNo !== '') ? "r_{$stuId}_{$rNo}" : "id_" . ($item['item_type'] ?? 'fee') . '_' . ($item['id'] ?? uniqid());

            if (!isset($groups[$groupKey])) {
                $groups[$groupKey] = [
                    'receipt_no' => $rNo,
                    'deposit_time' => $item['deposit_time'] ?? '',
                    'student_name' => $item['student_name'] ?? '',
                    'class_name' => $item['class_name'] ?? '',
                    'class_section' => $item['class_section'] ?? '',
                    'class_id' => $item['class_id'] ?? 999999,
                    'roll_no' => $item['roll_no'] ?? '',
                    'collector_phone' => $item['collector_phone'] ?? '',
                    'collected_by' => $item['collected_by'] ?? 'School Admin',
                    'amount' => (float)($item['amount'] ?? 0),
                    'discount_amount' => (float)($item['discount_amount'] ?? 0),
                    'student_academic_year_id' => $item['student_academic_year_id'] ?? null,
                    'items' => [$item]
                ];
            } else {
                $groups[$groupKey]['items'][] = $item;
                $groups[$groupKey]['amount'] += (float)($item['amount'] ?? 0);
                $groups[$groupKey]['discount_amount'] += (float)($item['discount_amount'] ?? 0);
                if (!empty($item['deposit_time']) && strtotime((string)$item['deposit_time']) < strtotime((string)$groups[$groupKey]['deposit_time'])) {
                    $groups[$groupKey]['deposit_time'] = $item['deposit_time'];
                }
            }
        }

        $consolidated = [];
        foreach ($groups as $g) {
            $items = $g['items'];

            $monthsList = [];
            $feeNamesList = [];
            foreach ($items as $it) {
                $rawType = trim((string)($it['fee_type'] ?? ''));
                $rawMonths = trim((string)($it['months_covered'] ?? ''));
                $itemType = $it['item_type'] ?? '';

                // Detect monthly fee
                if ($itemType === 'monthly' || str_starts_with(strtolower($rawType), 'monthly fee')) {
                    if (!empty($rawMonths) && $rawMonths !== 'N/A') {
                        $parts = array_map('trim', explode(',', $rawMonths));
                        foreach ($parts as $p) {
                            if ($p !== '') $monthsList[] = $p;
                        }
                    } elseif (preg_match('/monthly fee\s*\(([^)]+)\)/i', $rawType, $m)) {
                        $parts = array_map('trim', explode(',', $m[1]));
                        foreach ($parts as $p) {
                            if ($p !== '') $monthsList[] = $p;
                        }
                    }
                } else {
                    if (!empty($rawType)) {
                        $feeNamesList[] = $rawType;
                    }
                }
            }

            $feeTypeDisplay = '';
            $monthsCoveredDisplay = 'N/A';

            if (!empty($monthsList)) {
                $uniqueMonths = array_values(array_unique($monthsList));
                usort($uniqueMonths, function($a, $b) use ($academicMonths) {
                    $idxA = array_search($a, $academicMonths, true);
                    $idxB = array_search($b, $academicMonths, true);
                    return ($idxA === false ? 99 : $idxA) - ($idxB === false ? 99 : $idxB);
                });

                $isConsecutive = true;
                for ($i = 0; $i < count($uniqueMonths) - 1; $i++) {
                    $idx1 = array_search($uniqueMonths[$i], $academicMonths, true);
                    $idx2 = array_search($uniqueMonths[$i+1], $academicMonths, true);
                    if ($idx1 === false || $idx2 === false || $idx2 !== $idx1 + 1) {
                        $isConsecutive = false;
                        break;
                    }
                }

                if ($isConsecutive && count($uniqueMonths) > 1) {
                    $monthsCoveredDisplay = $uniqueMonths[0] . ' to ' . $uniqueMonths[count($uniqueMonths) - 1];
                } else {
                    $monthsCoveredDisplay = implode(', ', $uniqueMonths);
                }

                $feeTypeDisplay = 'Monthly Fee';
            }

            if (!empty($feeNamesList)) {
                $uniqueNames = array_values(array_unique($feeNamesList));
                $addStr = implode(', ', $uniqueNames);
                if ($feeTypeDisplay !== '') {
                    $feeTypeDisplay .= ', ' . $addStr;
                } else {
                    $feeTypeDisplay = $addStr;
                }
            }

            if ($feeTypeDisplay === '') {
                $feeTypeDisplay = 'Fee Payment';
            }

            $consolidated[] = [
                'receipt_no' => $g['receipt_no'],
                'deposit_time' => $g['deposit_time'],
                'student_name' => $g['student_name'],
                'class_name' => $g['class_name'],
                'class_section' => $g['class_section'],
                'class_id' => $g['class_id'],
                'roll_no' => $g['roll_no'],
                'fee_type' => $feeTypeDisplay,
                'months_covered' => $monthsCoveredDisplay,
                'discount_amount' => round($g['discount_amount'], 2),
                'amount' => round($g['amount'], 2),
                'collector_phone' => $g['collector_phone'],
                'collected_by' => $g['collected_by']
            ];
        }

        // Sort fee collections in descending order (most recent deposit on top, like PhonePe/Paytm)
        usort($consolidated, function($a, $b) {
            $timeA = !empty($a['deposit_time']) ? strtotime((string)$a['deposit_time']) : 0;
            $timeB = !empty($b['deposit_time']) ? strtotime((string)$b['deposit_time']) : 0;
            if ($timeA !== $timeB) {
                return $timeB <=> $timeA;
            }
            $classIdA = isset($a['class_id']) ? (int)$a['class_id'] : 999999;
            $classIdB = isset($b['class_id']) ? (int)$b['class_id'] : 999999;
            if ($classIdA !== $classIdB) {
                return $classIdA <=> $classIdB;
            }
            return strcmp($a['student_name'] ?? '', $b['student_name'] ?? '');
        });

        return $consolidated;
    }

    private static function buildFeeCollectionSheet(array $feeCollections): array
    {
        // Consolidate multi-month tuition and multi-additional fees sharing receipt_no into 1 transaction row
        $feeCollections = self::consolidateFeeCollections($feeCollections);

        $rows = [];
        
        // Header Row
        $rows[] = [
            'isHeader' => true,
            'cells' => [
                'Deposit By',
                'Fee Deposit Date & Time',
                'Student Name',
                'Class',
                'Roll Number',
                'Fee Type',
                'Months Covered',
                'Discount',
                'Fee Amount'
            ]
        ];

        $totalFee = 0.0;
        $totalDiscount = 0.0;
        foreach ($feeCollections as $row) {
            $amt = round((float)($row['amount'] ?? 0), 2);
            $totalFee = round($totalFee + $amt, 2);

            $disc = round((float)($row['discount_amount'] ?? 0), 2);
            $totalDiscount = round($totalDiscount + $disc, 2);

            $depTime = '';
            if (!empty($row['deposit_time'])) {
                $depTime = date('j M Y (h:i A)', strtotime((string)$row['deposit_time']));
            }

            $className = $row['class_name'] ?? '';
            if (!empty($row['class_section'])) {
                $className .= ' - ' . $row['class_section'];
            }

            $depositBy = !empty($row['collector_phone']) ? (string)$row['collector_phone'] : (!empty($row['collected_by']) ? (string)$row['collected_by'] : '');

            $rows[] = [
                'isHeader' => false,
                'cells' => [
                    $depositBy,
                    $depTime,
                    $row['student_name'] ?? '',
                    $className,
                    (string)($row['roll_no'] ?? ''),
                    $row['fee_type'] ?? '',
                    $row['months_covered'] ?? '',
                    $disc,
                    $amt
                ]
            ];
        }

        // Total Row
        $rows[] = [
            'isHeader' => true,
            'cells' => [
                'Total Fee Collection',
                '', '', '', '', '', '',
                $totalDiscount,
                $totalFee
            ]
        ];

        return [
            'name' => 'Student Fee Collection',
            'rows' => $rows
        ];
    }

    private static function buildExpensesSheet(array $expenses): array
    {
        // Sort expenses in descending order (most recent expense on top, like PhonePe/Paytm)
        usort($expenses, function($a, $b) {
            $timeA = !empty($a['expense_date']) ? strtotime((string)$a['expense_date']) : (!empty($a['created_at']) ? strtotime((string)$a['created_at']) : 0);
            $timeB = !empty($b['expense_date']) ? strtotime((string)$b['expense_date']) : (!empty($b['created_at']) ? strtotime((string)$b['created_at']) : 0);
            if ($timeA !== $timeB) {
                return $timeB <=> $timeA;
            }
            $createdA = !empty($a['created_at']) ? strtotime((string)$a['created_at']) : 0;
            $createdB = !empty($b['created_at']) ? strtotime((string)$b['created_at']) : 0;
            if ($createdA !== $createdB) {
                return $createdB <=> $createdA;
            }
            return strcmp($a['description'] ?? '', $b['description'] ?? '');
        });

        $rows = [];

        // Header Row
        $rows[] = [
            'isHeader' => true,
            'cells' => [
                'Added By',
                'Expense Description',
                'Category',
                'Expense Date',
                'Amount'
            ]
        ];

        $totalExp = 0.0;
        foreach ($expenses as $row) {
            $amt = round((float)($row['amount'] ?? 0), 2);
            $totalExp = round($totalExp + $amt, 2);

            $expDate = '';
            $rawDate = !empty($row['expense_date']) ? $row['expense_date'] : ($row['created_at'] ?? '');
            if (!empty($rawDate)) {
                $expDate = date('j M Y', strtotime((string)$rawDate));
            }

            $addedBy = !empty($row['added_by_phone']) ? (string)$row['added_by_phone'] : (!empty($row['added_by']) ? (string)$row['added_by'] : 'School Admin');

            $rows[] = [
                'isHeader' => false,
                'cells' => [
                    $addedBy,
                    $row['description'] ?? '',
                    $row['category'] ?? '',
                    $expDate,
                    $amt
                ]
            ];
        }

        // Total Row
        $rows[] = [
            'isHeader' => true,
            'cells' => [
                'Total Expenses',
                '', '', '',
                $totalExp
            ]
        ];

        return [
            'name' => 'Expenses',
            'rows' => $rows
        ];
    }

    private static function buildSummarySheet(array $summary): array
    {
        $revenue = round((float)($summary['revenue'] ?? 0), 2);
        $expenses = round((float)($summary['expenses'] ?? 0), 2);
        $diff = round($revenue - $expenses, 2);

        $rows = [];

        // Header
        $rows[] = [
            'isHeader' => true,
            'cells' => ['Summary Item', 'Amount']
        ];

        $rows[] = [
            'isHeader' => false,
            'cells' => ['Total Revenue (Fees Collected)', $revenue]
        ];

        $rows[] = [
            'isHeader' => false,
            'cells' => ['Total Expenses (Salaries & Expenses)', $expenses]
        ];

        if ($diff >= 0) {
            $rows[] = [
                'isHeader' => true,
                'cells' => ['Net Profit', $diff]
            ];
        } else {
            $rows[] = [
                'isHeader' => true,
                'cells' => ['Net Loss', abs($diff)]
            ];
        }

        return [
            'name' => 'Profit - Loss Summary',
            'rows' => $rows
        ];
    }

    private static function buildZipXlsx(array $sheets): string
    {
        $tempFile = tempnam(sys_get_temp_dir(), 'xlsx_');
        $zip = new ZipArchive();
        if ($zip->open($tempFile, ZipArchive::CREATE | ZipArchive::OVERWRITE) !== true) {
            throw new RuntimeException("Cannot create temp zip file");
        }

        // 1. [Content_Types].xml
        $contentTypes = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' . "\n";
        $contentTypes .= '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' . "\n";
        $contentTypes .= '  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' . "\n";
        $contentTypes .= '  <Default Extension="xml" ContentType="application/xml"/>' . "\n";
        $contentTypes .= '  <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>' . "\n";
        $contentTypes .= '  <Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>' . "\n";

        foreach ($sheets as $idx => $sheet) {
            $sheetNum = $idx + 1;
            $contentTypes .= "  <Override PartName=\"/xl/worksheets/sheet{$sheetNum}.xml\" ContentType=\"application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml\"/>\n";
        }
        $contentTypes .= '</Types>';
        $zip->addFromString('[Content_Types].xml', $contentTypes);

        // 2. _rels/.rels
        $rels = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' . "\n";
        $rels .= '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' . "\n";
        $rels .= '  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>' . "\n";
        $rels .= '</Relationships>';
        $zip->addFromString('_rels/.rels', $rels);

        // 3. xl/_rels/workbook.xml.rels
        $wbRels = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' . "\n";
        $wbRels .= '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' . "\n";
        $wbRels .= '  <Relationship Id="rIdStyles" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>' . "\n";
        foreach ($sheets as $idx => $sheet) {
            $sheetNum = $idx + 1;
            $wbRels .= "  <Relationship Id=\"rId{$sheetNum}\" Type=\"http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet\" Target=\"worksheets/sheet{$sheetNum}.xml\"/>\n";
        }
        $wbRels .= '</Relationships>';
        $zip->addFromString('xl/_rels/workbook.xml.rels', $wbRels);

        // 4. xl/workbook.xml
        $wb = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' . "\n";
        $wb .= '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">' . "\n";
        $wb .= '  <sheets>' . "\n";
        foreach ($sheets as $idx => $sheet) {
            $sheetNum = $idx + 1;
            $sheetName = htmlspecialchars((string)$sheet['name'], ENT_QUOTES | ENT_XML1);
            $wb .= "    <sheet name=\"{$sheetName}\" sheetId=\"{$sheetNum}\" r:id=\"rId{$sheetNum}\"/>\n";
        }
        $wb .= '  </sheets>' . "\n";
        $wb .= '</workbook>';
        $zip->addFromString('xl/workbook.xml', $wb);

        // 5. xl/styles.xml (Include bold styling and cell formatting)
        $styles = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' . "\n";
        $styles .= '<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' . "\n";
        $styles .= '  <fonts count="2">' . "\n";
        $styles .= '    <font><sz val="11"/><color theme="1"/><name val="Calibri"/></font>' . "\n";
        $styles .= '    <font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Calibri"/></font>' . "\n"; // Style 1: Bold white
        $styles .= '  </fonts>' . "\n";
        $styles .= '  <fills count="3">' . "\n";
        $styles .= '    <fill><patternFill patternType="none"/></fill>' . "\n";
        $styles .= '    <fill><patternFill patternType="gray125"/></fill>' . "\n";
        $styles .= '    <fill><patternFill patternType="solid"><fgColor rgb="FF365F91"/><bgColor indexed="64"/></patternFill></fill>' . "\n"; // Style 2: Navy Header
        $styles .= '  </fills>' . "\n";
        $styles .= '  <borders count="1">' . "\n";
        $styles .= '    <border><left/><right/><top/><bottom/><diagonal/></border>' . "\n";
        $styles .= '  </borders>' . "\n";
        $styles .= '  <cellStyleXfs count="1">' . "\n";
        $styles .= '    <xf numFmtId="0" fontId="0" fillId="0" borderId="0"/>' . "\n";
        $styles .= '  </cellStyleXfs>' . "\n";
        $styles .= '  <cellXfs count="2">' . "\n";
        $styles .= '    <xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>' . "\n"; // 0: Normal
        $styles .= '    <xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1"/>' . "\n"; // 1: Header
        $styles .= '  </cellXfs>' . "\n";
        $styles .= '</styleSheet>';
        $zip->addFromString('xl/styles.xml', $styles);

        // 6. xl/worksheets/sheetN.xml
        foreach ($sheets as $idx => $sheet) {
            $sheetNum = $idx + 1;
            $sheetXml = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' . "\n";
            $sheetXml .= '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' . "\n";
            $sheetXml .= '  <sheetData>' . "\n";

            foreach ($sheet['rows'] as $rIdx => $row) {
                $rowNum = $rIdx + 1;
                $isHeader = !empty($row['isHeader']);
                $styleAttr = $isHeader ? ' s="1"' : '';
                $sheetXml .= "    <row r=\"{$rowNum}\"{$styleAttr}>\n";

                foreach ($row['cells'] as $cIdx => $val) {
                    $colLetter = self::cellColumnLetter($cIdx + 1);
                    $cellRef = "{$colLetter}{$rowNum}";

                    if (is_numeric($val) && !self::isStringWithLeadingZero((string)$val)) {
                        $numVal = round((float)$val, 2);
                        $displayVal = (floor($numVal) == $numVal) ? (string)(int)$numVal : (string)$numVal;
                        $sheetXml .= "      <c r=\"{$cellRef}\"{$styleAttr}><v>{$displayVal}</v></c>\n";
                    } else {
                        $escaped = htmlspecialchars((string)$val, ENT_QUOTES | ENT_XML1);
                        $sheetXml .= "      <c r=\"{$cellRef}\" t=\"inlineStr\"{$styleAttr}><is><t>{$escaped}</t></is></c>\n";
                    }
                }
                $sheetXml .= "    </row>\n";
            }

            $sheetXml .= '  </sheetData>' . "\n";
            $sheetXml .= '</worksheet>';
            $zip->addFromString("xl/worksheets/sheet{$sheetNum}.xml", $sheetXml);
        }

        $zip->close();
        $data = file_get_contents($tempFile);
        @unlink($tempFile);
        return $data;
    }

    private static function cellColumnLetter(int $col): string
    {
        $colStr = '';
        while ($col > 0) {
            $mod = ($col - 1) % 26;
            $colStr = chr(65 + $mod) . $colStr;
            $col = (int)(($col - $mod) / 26);
        }
        return $colStr;
    }

    private static function isStringWithLeadingZero(string $val): bool
    {
        if (strlen($val) > 1 && $val[0] === '0' && is_numeric($val)) {
            return true;
        }
        return false;
    }
}
