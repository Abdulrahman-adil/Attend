const { DateTime, IANAZone } = require('luxon');
const { fail } = require('./http');
function timezone(value) {
  if (typeof value !== 'string' || value.length > 100 || !IANAZone.isValidZone(value)) fail(400, 'Choose a valid IANA timezone, such as Asia/Dubai.', 'INVALID_TIMEZONE');
  return value;
}
function dayWindow(now, zone, offset = 0) {
  const day = DateTime.fromJSDate(now, { zone }).startOf('day').plus({ days: offset });
  return { date: day.toISODate(), start: day.toUTC().toISO(), end: day.plus({ days: 1 }).toUTC().toISO() };
}
module.exports = { timezone, dayWindow };
