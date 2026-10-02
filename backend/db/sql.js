function convertPlaceholders(sql) {
  let index = 0;
  let result = "";

  let inSingleQuote = false;
  let inDoubleQuote = false;

  for (let i = 0; i < sql.length; i += 1) {
    const char = sql[i];
    const next = sql[i + 1];

    if (char === "'" && !inDoubleQuote) {
      // SQL escapes a single quote as ''
      if (inSingleQuote && next === "'") {
        result += "''";
        i += 1;
        continue;
      }

      inSingleQuote = !inSingleQuote;
      result += char;
      continue;
    }

    if (char === '"' && !inSingleQuote) {
      // SQL escapes a double quote as ""
      if (inDoubleQuote && next === '"') {
        result += '""';
        i += 1;
        continue;
      }

      inDoubleQuote = !inDoubleQuote;
      result += char;
      continue;
    }

    if (char === "?" && !inSingleQuote && !inDoubleQuote) {
      index += 1;
      result += `$${index}`;
      continue;
    }

    result += char;
  }

  return result;
}

module.exports = {
  convertPlaceholders,
};
