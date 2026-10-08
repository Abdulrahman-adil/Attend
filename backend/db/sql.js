// Transitional notation only; execution/results are PostgreSQL.
// Prefer native $n parameters in new SQL. Escape a PostgreSQL ? operator as ??.
function convertPlaceholders(sql) {
  let result = '', index = 0, native = false;
  for (let i = 0; i < sql.length;) {
    const rest = sql.slice(i);
    const dollar = /^(\$[A-Za-z_][A-Za-z_0-9]*\$|\$\$)/.exec(rest);
    if (dollar) {
      const end = sql.indexOf(dollar[0], i + dollar[0].length);
      if (end < 0) throw new Error('Unterminated SQL dollar quote.');
      result += sql.slice(i, end + dollar[0].length); i = end + dollar[0].length; continue;
    }
    if (rest.startsWith('--')) {
      const end = sql.indexOf('\n', i), stop = end < 0 ? sql.length : end;
      result += sql.slice(i, stop); i = stop; continue;
    }
    if (rest.startsWith('/*')) {
      let depth = 1, end = i + 2;
      while (end < sql.length && depth) {
        if (sql.slice(end, end + 2) === '/*') { depth++; end += 2; }
        else if (sql.slice(end, end + 2) === '*/') { depth--; end += 2; }
        else end++;
      }
      if (depth) throw new Error('Unterminated SQL comment.');
      result += sql.slice(i, end); i = end; continue;
    }
    if (sql[i] === "'" || sql[i] === '"') {
      const quote = sql[i], start = i++;
      const escapes = quote === "'" && /(?:^|\W)[eE]$/.test(sql.slice(0, start));
      let closed = false;
      while (i < sql.length) {
        if (escapes && sql[i] === '\\') { i += 2; continue; }
        if (sql[i++] === quote) {
          if (sql[i] === quote) { i++; continue; }
          closed = true; break;
        }
      }
      if (!closed) throw new Error('Unterminated SQL quote.');
      result += sql.slice(start, i); continue;
    }
    if (/^\$\d+/.test(rest)) native = true;
    if (sql[i] === '?' && sql[i + 1] === '?') { result += '?'; i += 2; }
    else if (sql[i] === '?') { result += '$' + ++index; i++; }
    else result += sql[i++];
  }
  if (native && index) throw new Error('Do not mix native and transitional SQL parameters.');
  return result;
}
module.exports = { convertPlaceholders };
