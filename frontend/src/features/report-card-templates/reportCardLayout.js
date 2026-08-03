/**
 * Shared bottom-of-page spacing for every report card template.
 *
 * The templates render the performance summary row (Total Marks, Percentage,
 * Overall Grade, Attendance, Class Rank) directly above the signature line, and
 * both are pinned to the bottom of the page.
 *
 * These are declared in millimetres rather than Tailwind spacing steps because
 * the card is a print artefact: the values below describe physical room on the
 * paper for a rubber stamp and a handwritten signature, so they should be read
 * in the same units the person signing the sheet cares about.
 *
 * SIGNATURE_GAP  clear space between the summary boxes and the signature area.
 * STAMP_SPACE    blank room above each signature line — a typical school stamp
 *                is 25-30mm across, and a signature sits over or beside it.
 *
 * Note: SinglePageReportCardWrapper scales the whole card down when content
 * overflows one A4 page, so on a very long subject list these gaps shrink
 * proportionally along with everything else.
 */
export const SIGNATURE_GAP = '10mm';
export const STAMP_SPACE = '14mm';

/**
 * Minimum height of the card body, so the footer can be pinned to the bottom of
 * the page independently of how tall the marks table is.
 *
 * This has to be a definite length rather than `minHeight: '100%'`. The percentage
 * resolved against SinglePageReportCardWrapper's container, which is `height:
 * auto` unless the card is being scaled down — and a percentage min-height
 * against an auto-height parent resolves to zero, which left `mt-auto` with no
 * free space and made the footer ride up directly under the table.
 *
 * 265mm sits just under the wrapper's 270mm (1020px) single-page budget, so a
 * short card fills the page without tripping the auto-scaler; a long subject
 * list still overflows it and scales down exactly as before.
 */
export const PAGE_CONTENT_MIN_HEIGHT = '265mm';
