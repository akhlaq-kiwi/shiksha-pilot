<?php
// backend/src/Database/school_directory_seeder.php
//
// Seeds school_directory from school_directory_dataset.csv (CBSE
// affiliation data, CC BY-SA 4.0, see Migrations/006_create_school_directory.sql
// for provenance). Idempotent like vocabulary_seeder.php: skips if the
// table already looks populated, so re-running migrate.php is always safe.

function slugify_directory_value(string $value): string
{
    $slug = strtolower(trim($value));
    $slug = preg_replace('/[^a-z0-9\s-]/', '', $slug);
    $slug = preg_replace('/\s+/', '-', $slug);
    $slug = preg_replace('/-+/', '-', $slug);
    return trim($slug, '-');
}

function seedSchoolDirectory(\PDO $pdo): void
{
    echo "Checking if school_directory table needs seeding...\n";
    $count = (int) $pdo->query('SELECT COUNT(*) FROM school_directory')->fetchColumn();

    // The dataset is exactly 20,367 rows — anything close to that means
    // a previous run already completed.
    if ($count >= 20000) {
        echo "school_directory already contains $count schools. Skipping seeder.\n";
        return;
    }

    $csvPath = __DIR__ . '/school_directory_dataset.csv';
    if (!is_file($csvPath)) {
        echo "school_directory_dataset.csv not found — skipping directory seed.\n";
        return;
    }

    echo "Seeding school_directory from CSV...\n";
    $pdo->exec('TRUNCATE TABLE school_directory');

    $handle = fopen($csvPath, 'r');
    $header = fgetcsv($handle);

    $insert = $pdo->prepare(
        'INSERT INTO school_directory
            (name, affiliation_no, state, state_slug, district, district_slug, address, pincode, phone, email, website, level, board)
         VALUES
            (:name, :affiliation_no, :state, :state_slug, :district, :district_slug, :address, :pincode, :phone, :email, :website, :level, "CBSE")'
    );

    $pdo->beginTransaction();
    $imported = 0;

    while (($row = fgetcsv($handle)) !== false) {
        $data = array_combine($header, $row);
        if ($data === false || $data['name'] === '') {
            continue;
        }

        $state = trim($data['state']);
        $district = trim($data['district'] ?? '');

        $insert->execute([
            ':name'           => $data['name'],
            ':affiliation_no' => $data['aff_no'] !== '' ? $data['aff_no'] : null,
            ':state'          => $state,
            ':state_slug'     => slugify_directory_value($state),
            ':district'       => $district !== '' ? $district : null,
            ':district_slug'  => $district !== '' ? slugify_directory_value($district) : null,
            ':address'        => $data['address'] !== '' ? $data['address'] : null,
            ':pincode'        => $data['pincode'] !== '' ? $data['pincode'] : null,
            ':phone'          => $data['ph_no'] !== '' ? $data['ph_no'] : null,
            ':email'          => $data['email'] !== '' ? $data['email'] : null,
            ':website'        => $data['website'] !== '' ? $data['website'] : null,
            ':level'          => $data['status'] !== '' ? $data['status'] : null,
        ]);

        $imported++;
        if ($imported % 2000 === 0) {
            $pdo->commit();
            $pdo->beginTransaction();
            echo "  ...$imported rows\n";
        }
    }

    $pdo->commit();
    fclose($handle);

    echo "Seeded $imported schools into school_directory.\n";
}
