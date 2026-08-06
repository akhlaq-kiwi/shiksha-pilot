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

    private static function buildFeeCollectionSheet(array $feeCollections): array
    {
        $rows = [];
        
        // Header Row
        $rows[] = [
            'isHeader' => true,
            'cells' => [
                'Fee Deposit Date & Time',
                'Student Name',
                'Class',
                'Roll Number',
                'Fee Type',
                'Months Covered',
                'Fee Amount'
            ]
        ];

        $totalFee = 0.0;
        foreach ($feeCollections as $row) {
            $amt = (float)($row['amount'] ?? 0);
            $totalFee += $amt;

            $depTime = '';
            if (!empty($row['deposit_time'])) {
                $depTime = date('j M Y (h:i A)', strtotime((string)$row['deposit_time']));
            }

            $className = $row['class_name'] ?? '';
            if (!empty($row['class_section'])) {
                $className .= ' - ' . $row['class_section'];
            }

            $rows[] = [
                'isHeader' => false,
                'cells' => [
                    $depTime,
                    $row['student_name'] ?? '',
                    $className,
                    (string)($row['roll_no'] ?? ''),
                    $row['fee_type'] ?? '',
                    $row['months_covered'] ?? '',
                    $amt
                ]
            ];
        }

        // Total Row
        $rows[] = [
            'isHeader' => true,
            'cells' => [
                'Total Fee Collection',
                '', '', '', '', '',
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
        $rows = [];

        // Header Row
        $rows[] = [
            'isHeader' => true,
            'cells' => [
                'Expense Description',
                'Category',
                'Expense Date',
                'Amount'
            ]
        ];

        $totalExp = 0.0;
        foreach ($expenses as $row) {
            $amt = (float)($row['amount'] ?? 0);
            $totalExp += $amt;

            $expDate = '';
            if (!empty($row['expense_date'])) {
                $expDate = date('j M Y', strtotime((string)$row['expense_date']));
            }

            $rows[] = [
                'isHeader' => false,
                'cells' => [
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
                '', '',
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
        $revenue = (float)($summary['revenue'] ?? 0);
        $expenses = (float)($summary['expenses'] ?? 0);
        $diff = $revenue - $expenses;

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
                        $sheetXml .= "      <c r=\"{$cellRef}\"{$styleAttr}><v>{$val}</v></c>\n";
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
