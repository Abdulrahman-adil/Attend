CREATE TABLE IF NOT EXISTS users (
 id INTEGER PRIMARY KEY AUTOINCREMENT, google_id TEXT, name TEXT NOT NULL,
 email TEXT NOT NULL UNIQUE, password TEXT, role TEXT, company_id INTEGER,
 is_active INTEGER DEFAULT 0, activation_token TEXT, activation_token_expires INTEGER,
 FOREIGN KEY(company_id) REFERENCES companies(id)
);
CREATE TABLE IF NOT EXISTS companies (
 id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, owner_id INTEGER NOT NULL,
 logo_url TEXT, FOREIGN KEY(owner_id) REFERENCES users(id)
);
CREATE TABLE IF NOT EXISTS locations (
 id INTEGER PRIMARY KEY AUTOINCREMENT, company_id INTEGER NOT NULL, name TEXT NOT NULL,
 latitude REAL NOT NULL, longitude REAL NOT NULL, radius INTEGER NOT NULL,
 FOREIGN KEY(company_id) REFERENCES companies(id)
);
CREATE TABLE IF NOT EXISTS attendance (
 id INTEGER PRIMARY KEY AUTOINCREMENT, employee_id INTEGER NOT NULL, location_id INTEGER,
 check_in_time TEXT NOT NULL, check_out_time TEXT, check_in_latitude REAL NOT NULL,
 check_in_longitude REAL NOT NULL, check_out_latitude REAL, check_out_longitude REAL,
 FOREIGN KEY(employee_id) REFERENCES users(id), FOREIGN KEY(location_id) REFERENCES locations(id)
);
