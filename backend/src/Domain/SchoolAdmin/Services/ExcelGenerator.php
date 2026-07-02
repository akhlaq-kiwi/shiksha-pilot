<?php

declare(strict_types=1);

namespace App\Domain\SchoolAdmin\Services;

class ExcelGenerator
{
    public static function generate(array $feeCollections, array $expenses, array $summary): string
    {
        $xml = '<?xml version="1.0"?>' . "\n";
        $xml .= '<?mso-application progid="Excel.Sheet"?>' . "\n";
        $xml .= '<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"' . "\n";
        $xml .= ' xmlns:o="urn:schemas-microsoft-com:office:office"' . "\n";
        $xml .= ' xmlns:x="urn:schemas-microsoft-com:office:excel"' . "\n";
        $xml .= ' xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"' . "\n";
        $xml .= ' xmlns:html="http://www.w3.org/TR/REC-html40">' . "\n";

        // Styles
        $xml .= ' <Styles>' . "\n";
        $xml .= '  <Style ss:Id="Default" ss:Name="Normal">' . "\n";
        $xml .= '   <Alignment ss:Vertical="Bottom"/>' . "\n";
        $xml .= '   <Borders/>' . "\n";
        $xml .= '   <Font ss:FontName="Calibri" x:CharSet="1" x:Family="Swiss" ss:Size="11" ss:Color="#000000"/>' . "\n";
        $xml .= '   <Interior/>' . "\n";
        $xml .= '   <NumberFormat/>' . "\n";
        $xml .= '   <Protection/>' . "\n";
        $xml .= '  </Style>' . "\n";
        $xml .= '  <Style ss:Id="Header">' . "\n";
        $xml .= '   <Font ss:FontName="Calibri" ss:Size="11" ss:Color="#FFFFFF" ss:Bold="1"/>' . "\n";
        $xml .= '   <Interior ss:Color="#365F91" ss:Pattern="Solid"/>' . "\n";
        $xml .= '  </Style>' . "\n";
        $xml .= '  <Style ss:Id="BoldText">' . "\n";
        $xml .= '   <Font ss:FontName="Calibri" ss:Size="11" ss:Bold="1"/>' . "\n";
        $xml .= '  </Style>' . "\n";
        $xml .= ' </Styles>' . "\n";

        // Sheet 1: Student Fee Collection
        $xml .= ' <Worksheet ss:Name="Student Fee Collection">' . "\n";
        $xml .= '  <Table>' . "\n";
        $xml .= '   <Row ss:StyleID="Header">' . "\n";
        $xml .= '    <Cell><Data ss:Type="String">Student Name</Data></Cell>' . "\n";
        $xml .= '    <Cell><Data ss:Type="String">Admission Number</Data></Cell>' . "\n";
        $xml .= '    <Cell><Data ss:Type="String">Class</Data></Cell>' . "\n";
        $xml .= '    <Cell><Data ss:Type="String">Payment Date</Data></Cell>' . "\n";
        $xml .= '    <Cell><Data ss:Type="String">Payment Type</Data></Cell>' . "\n";
        $xml .= '    <Cell><Data ss:Type="String">Amount</Data></Cell>' . "\n";
        $xml .= '   </Row>' . "\n";

        $totalFee = 0.0;
        foreach ($feeCollections as $row) {
            $totalFee += (float)$row['amount'];
            $xml .= '   <Row>' . "\n";
            $xml .= '    <Cell><Data ss:Type="String">' . htmlspecialchars($row['student_name'] ?? '') . '</Data></Cell>' . "\n";
            $xml .= '    <Cell><Data ss:Type="String">' . htmlspecialchars($row['admission_no'] ?? '') . '</Data></Cell>' . "\n";
            $xml .= '    <Cell><Data ss:Type="String">' . htmlspecialchars($row['class_name'] ?? '') . '</Data></Cell>' . "\n";
            $xml .= '    <Cell><Data ss:Type="String">' . htmlspecialchars($row['payment_date'] ?? '') . '</Data></Cell>' . "\n";
            $xml .= '    <Cell><Data ss:Type="String">' . htmlspecialchars($row['payment_type'] ?? '') . '</Data></Cell>' . "\n";
            $xml .= '    <Cell><Data ss:Type="Number">' . $row['amount'] . '</Data></Cell>' . "\n";
            $xml .= '   </Row>' . "\n";
        }
        // Total row
        $xml .= '   <Row ss:StyleID="BoldText">' . "\n";
        $xml .= '    <Cell><Data ss:Type="String">Total Fee Collection</Data></Cell>' . "\n";
        $xml .= '    <Cell ss:Index="6"><Data ss:Type="Number">' . $totalFee . '</Data></Cell>' . "\n";
        $xml .= '   </Row>' . "\n";
        $xml .= '  </Table>' . "\n";
        $xml .= ' </Worksheet>' . "\n";

        // Sheet 2: Expenses
        $xml .= ' <Worksheet ss:Name="Expenses">' . "\n";
        $xml .= '  <Table>' . "\n";
        $xml .= '   <Row ss:StyleID="Header">' . "\n";
        $xml .= '    <Cell><Data ss:Type="String">Expense Description</Data></Cell>' . "\n";
        $xml .= '    <Cell><Data ss:Type="String">Category</Data></Cell>' . "\n";
        $xml .= '    <Cell><Data ss:Type="String">Expense Date</Data></Cell>' . "\n";
        $xml .= '    <Cell><Data ss:Type="String">Amount</Data></Cell>' . "\n";
        $xml .= '   </Row>' . "\n";

        $totalExp = 0.0;
        foreach ($expenses as $row) {
            $totalExp += (float)$row['amount'];
            $xml .= '   <Row>' . "\n";
            $xml .= '    <Cell><Data ss:Type="String">' . htmlspecialchars($row['description'] ?? '') . '</Data></Cell>' . "\n";
            $xml .= '    <Cell><Data ss:Type="String">' . htmlspecialchars($row['category'] ?? '') . '</Data></Cell>' . "\n";
            $xml .= '    <Cell><Data ss:Type="String">' . htmlspecialchars($row['expense_date'] ?? '') . '</Data></Cell>' . "\n";
            $xml .= '    <Cell><Data ss:Type="Number">' . $row['amount'] . '</Data></Cell>' . "\n";
            $xml .= '   </Row>' . "\n";
        }
        // Total row
        $xml .= '   <Row ss:StyleID="BoldText">' . "\n";
        $xml .= '    <Cell><Data ss:Type="String">Total Expenses</Data></Cell>' . "\n";
        $xml .= '    <Cell ss:Index="4"><Data ss:Type="Number">' . $totalExp . '</Data></Cell>' . "\n";
        $xml .= '   </Row>' . "\n";
        $xml .= '  </Table>' . "\n";
        $xml .= ' </Worksheet>' . "\n";

        // Sheet 3: Profit / Loss Summary
        $xml .= ' <Worksheet ss:Name="Profit - Loss Summary">' . "\n";
        $xml .= '  <Table>' . "\n";
        $xml .= '   <Row>' . "\n";
        $xml .= '    <Cell ss:StyleID="BoldText"><Data ss:Type="String">Total Revenue</Data></Cell>' . "\n";
        $xml .= '    <Cell><Data ss:Type="Number">' . $summary['revenue'] . '</Data></Cell>' . "\n";
        $xml .= '   </Row>' . "\n";
        $xml .= '   <Row>' . "\n";
        $xml .= '    <Cell ss:StyleID="BoldText"><Data ss:Type="String">Total Expenses</Data></Cell>' . "\n";
        $xml .= '    <Cell><Data ss:Type="Number">' . $summary['expenses'] . '</Data></Cell>' . "\n";
        $xml .= '   </Row>' . "\n";

        $diff = $summary['revenue'] - $summary['expenses'];
        if ($diff >= 0) {
            $xml .= '   <Row ss:StyleID="BoldText">' . "\n";
            $xml .= '    <Cell><Data ss:Type="String">Profit</Data></Cell>' . "\n";
            $xml .= '    <Cell><Data ss:Type="Number">' . $diff . '</Data></Cell>' . "\n";
            $xml .= '   </Row>' . "\n";
        } else {
            $xml .= '   <Row ss:StyleID="BoldText">' . "\n";
            $xml .= '    <Cell><Data ss:Type="String">Loss</Data></Cell>' . "\n";
            $xml .= '    <Cell><Data ss:Type="Number">' . abs($diff) . '</Data></Cell>' . "\n";
            $xml .= '   </Row>' . "\n";
        }

        $xml .= '  </Table>' . "\n";
        $xml .= ' </Worksheet>' . "\n";

        $xml .= '</Workbook>' . "\n";
        return $xml;
    }
}
