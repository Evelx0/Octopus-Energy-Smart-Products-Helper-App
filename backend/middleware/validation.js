const DATE_RE   = /^\d{4}-\d{2}-\d{2}$/;
const REGION_RE = /^[A-HJ-NP]$/;                     // UK DNO regions A–P, excluding unused I and O
const POST_RE   = /^[A-Z]{1,2}[0-9][0-9A-Z]?[0-9][A-Z]{2}$/; // cleaned postcode (no spaces, format-validated)

// Earliest date we'll accept — safely before any Octopus smart tariff existed
const MIN_DATE = new Date('2016-01-01T00:00:00Z');

/**
 * Returns true only if str is a real calendar date.
 * Catches format-valid but semantically invalid dates like 2025-02-30.
 */
function isRealDate(str) {
  const [y, m, d] = str.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  return (
    dt.getFullYear() === y &&
    dt.getMonth()    === m - 1 &&
    dt.getDate()     === d
  );
}

/**
 * Ensures all common input formats are correct before any business logic runs.
 * Fails fast with 400 Bad Request on any validation failure.
 */
function validateInput(req, res, next) {
  const { postcode, region, date, dateFrom, dateTo } = req.body;

  // ── Postcode ────────────────────────────────────────────────────────────────
  if (postcode) {
    // Reject non-string types before regex — arrays/objects coerce to strings and can bypass
    if (typeof postcode !== 'string') {
      return res.status(400).json({ error: 'Invalid UK postcode format.' });
    }
    const cleanPostcode = postcode.replace(/\s+/g, '').toUpperCase();
    if (!POST_RE.test(cleanPostcode)) {
      return res.status(400).json({ error: 'Invalid UK postcode format.' });
    }
    // Write normalised value back so downstream routes receive a clean string
    req.body.postcode = cleanPostcode;
  }

  // ── Region ──────────────────────────────────────────────────────────────────
  if (region !== undefined && region !== null && region !== '') {
    // Reject non-string types before regex — e.g. ["H"].toString() === "H" passes /^[A-P]$/
    if (typeof region !== 'string') {
      return res.status(400).json({ error: 'Invalid DNO region code. Must be a single letter A–P.' });
    }
    if (!REGION_RE.test(region)) {
      return res.status(400).json({ error: 'Invalid DNO region code. Must be a single letter A–P.' });
    }
  }

  // ── Date helper ─────────────────────────────────────────────────────────────
  // Max accepted date: day after tomorrow (buffer for timezone edge cases with
  // tomorrow's Agile / Tracker rates being published late evening)
  function validateDateField(val, fieldName) {
    // Reject non-string types before regex to prevent coercion bypasses and 500s
    if (typeof val !== 'string') {
      return `${fieldName} must be a string in YYYY-MM-DD format.`;
    }
    if (!DATE_RE.test(val)) {
      return `Invalid ${fieldName} format. Must be YYYY-MM-DD.`;
    }
    if (!isRealDate(val)) {
      return `${fieldName} is not a real calendar date (e.g. month 13 or day 31 in February).`;
    }
    const dt = new Date(val + 'T00:00:00Z');
    if (dt < MIN_DATE) {
      return `${fieldName} must be on or after 2016-01-01.`;
    }
    const dayAfterTomorrow = new Date();
    dayAfterTomorrow.setUTCDate(dayAfterTomorrow.getUTCDate() + 2);
    if (dt > dayAfterTomorrow) {
      return `${fieldName} must not be more than one day in the future.`;
    }
    return null; // valid
  }

  if (date) {
    const err = validateDateField(date, 'date');
    if (err) return res.status(400).json({ error: err });
  }

  if (dateFrom) {
    const err = validateDateField(dateFrom, 'dateFrom');
    if (err) return res.status(400).json({ error: err });
  }

  if (dateTo) {
    const err = validateDateField(dateTo, 'dateTo');
    if (err) return res.status(400).json({ error: err });
  }

  // ── Cross-field range check ──────────────────────────────────────────────────
  if (dateFrom && dateTo) {
    const from = new Date(dateFrom + 'T00:00:00Z');
    const to   = new Date(dateTo   + 'T00:00:00Z');
    if (from > to) {
      return res.status(400).json({ error: 'dateFrom must be on or before dateTo.' });
    }
    const rangeDays = (to - from) / 86400000;
    if (rangeDays > 1100) {
      return res.status(400).json({ error: 'Date range must not exceed 1100 days (approx. 3 years).' });
    }
  }

  next();
}

module.exports = {
  validateInput,
  DATE_RE,
  REGION_RE,
  POST_RE,
  isRealDate,
  MIN_DATE,
};
