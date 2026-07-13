<?php

declare(strict_types=1);

namespace App\Shared\Pdf;

class SimplePdf
{
    private string $buffer = '';
    private array $offsets = [];

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
        $this->write("<< /Type /Page /Parent 2 0 R /Resources << /Font << /F1 << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> /F2 << /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >> >> >> /MediaBox [0 0 595.28 841.89] /Contents 4 0 R >>");
        $this->endobj();

        // Stream contents
        $stream = "BT\n";
        $stream .= "/F2 18 Tf\n50 780 Td\n(" . $this->escape($title) . ") Tj\n";
        $stream .= "/F1 11 Tf\n";

        $y = -35;
        foreach ($lines as $line) {
            if ($line === '---') {
                $stream .= "0 -15 Td\n(--------------------------------------------------------------------------------------------------------) Tj\n";
                $y = -15;
            } else {
                $stream .= "0 $y Td\n(" . $this->escape($line) . ") Tj\n";
                $y = -20;
            }
        }
        $stream .= "ET";

        // Obj 4: Contents
        $this->obj(4);
        $this->write("<< /Length " . strlen($stream) . " >>");
        $this->write("stream");
        $this->write($stream);
        $this->write("endstream");
        $this->endobj();

        // Cross-reference table
        $xref_pos = strlen($this->buffer);
        $this->write("xref");
        $this->write("0 5");
        $this->write("0000000000 65535 f ");
        for ($i = 1; $i <= 4; $i++) {
            $this->write(sprintf("%010d 00000 n ", $this->offsets[$i]));
        }

        $this->write("trailer");
        $this->write("<< /Size 5 /Root 1 0 R >>");
        $this->write("startxref");
        $this->write((string)$xref_pos);
        $this->write("%%EOF");

        return $this->buffer;
    }

    private function escape(string $str): string
    {
        return str_replace(['(', ')', '\\'], ['\\(', '\\)', '\\\\'], $str);
    }
}
