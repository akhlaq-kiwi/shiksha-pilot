<?php
/**
 * Templated SEO copy for the school directory (schools.php, schools-in.php).
 * Real data (school_directory table, see includes/db.php), templated
 * sentences — the state/city name is the only thing that changes between
 * pages, same principle as any programmatic-SEO page. Deliberately no
 * school counts in this copy — reads more like a place worth visiting,
 * less like a database dump, and avoids stale numbers going out of date
 * the moment the dataset is refreshed.
 */

/**
 * The source dataset stores state/district names in ALL CAPS (e.g.
 * "UTTAR PRADESH") — fine for slug generation and grouping, but reads as
 * shouting in headings/body copy. Display-only; never used for matching.
 */
function directory_display_name(string $name): string {
    return mb_convert_case(mb_strtolower($name), MB_CASE_TITLE);
}

function directory_state_description(string $state): string {
    return "Looking for the right school in {$state}? Browse CBSE-affiliated "
        . "schools city by city, with addresses and contact details for each. "
        . "Run one of these schools? See how Shiksha Pilot can take attendance, "
        . "exams, fees and timetables off your plate.";
}

function directory_state_meta_description(string $state): string {
    return "Find CBSE schools in {$state}, browsable by city — addresses and "
        . "contact details for schools across {$state}.";
}

function directory_district_description(string $city, string $states): string {
    return "Searching for a school in {$city}? Here's a curated list of "
        . "CBSE-affiliated schools in {$city}, with addresses so you can find "
        . "the right one close to home. Run one of these schools? See how "
        . "Shiksha Pilot handles attendance, fees and report cards in one place.";
}

function directory_district_meta_description(string $city): string {
    return "CBSE schools in {$city} — addresses and contact details, all in one place.";
}
