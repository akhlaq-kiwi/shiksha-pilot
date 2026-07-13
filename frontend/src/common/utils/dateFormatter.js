/**
 * Formats a date string, date object, or timestamp to standard format: "13 July 2026".
 * Always uses the full month name and includes a leading zero for single-digit days.
 * Timezone-safe: handles raw YYYY-MM-DD strings without shifts due to UTC offset.
 *
 * @param {string|Date|number} dateInput - The date to format
 * @returns {string} Formatted date (e.g. "13 July 2026")
 */
export function formatDate(dateInput) {
  if (!dateInput) return '';

  try {
    let date;

    if (typeof dateInput === 'string') {
      const cleaned = dateInput.trim();
      
      // Match ISO date string prefixes (e.g. 2026-07-13 or 2026-07-13T00:00:00Z)
      const yyyymmddRegex = /^(\d{4})-(\d{2})-(\d{2})(?:\s|T|$)/;
      const match = cleaned.match(yyyymmddRegex);

      if (match) {
        // Read components literally to avoid client-side timezone shifts
        const year = parseInt(match[1], 10);
        const monthIndex = parseInt(match[2], 10) - 1;
        const day = match[3].padStart(2, '0');

        const months = [
          'January', 'February', 'March', 'April', 'May', 'June',
          'July', 'August', 'September', 'October', 'November', 'December'
        ];
        const month = months[monthIndex];
        if (month) {
          return `${day} ${month} ${year}`;
        }
      }

      date = new Date(cleaned);
    } else if (dateInput instanceof Date) {
      date = dateInput;
    } else {
      date = new Date(dateInput);
    }

    if (isNaN(date.getTime())) {
      return String(dateInput);
    }

    const day = String(date.getDate()).padStart(2, '0');
    const months = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];
    const month = months[date.getMonth()];
    const year = date.getFullYear();

    return `${day} ${month} ${year}`;
  } catch (err) {
    return String(dateInput);
  }
}

/**
 * Formats a start and end date into a standardized range string: "13 July 2026 to 21 July 2026".
 *
 * @param {string|Date|number} startDateInput
 * @param {string|Date|number} endDateInput
 * @returns {string} Formatted range (e.g. "13 July 2026 to 21 July 2026")
 */
export function formatDateRange(startDateInput, endDateInput) {
  if (!startDateInput || !endDateInput) return '';
  return `${formatDate(startDateInput)} to ${formatDate(endDateInput)}`;
}
