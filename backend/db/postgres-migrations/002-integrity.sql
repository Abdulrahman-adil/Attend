-- Additive integrity changes only. Invalid existing rows stop/roll back migration.
ALTER TABLE users ADD CONSTRAINT users_normalized_email_check
  CHECK (normalized_email = lower(btrim(email)) AND length(btrim(name)) > 0);
ALTER TABLE locations ADD CONSTRAINT locations_radius_max CHECK (radius <= 100000);
ALTER TABLE companies ALTER COLUMN owner_id SET NOT NULL;
CREATE UNIQUE INDEX companies_one_owner ON companies(owner_id);
ALTER TABLE users ADD CONSTRAINT users_id_company_unique UNIQUE(id, company_id);
ALTER TABLE locations ADD CONSTRAINT locations_id_company_unique UNIQUE(id, company_id);
ALTER TABLE attendance ADD CONSTRAINT attendance_employee_tenant_fk
  FOREIGN KEY(employee_id, company_id) REFERENCES users(id, company_id);
ALTER TABLE attendance ADD CONSTRAINT attendance_location_tenant_fk
  FOREIGN KEY(location_id, company_id) REFERENCES locations(id, company_id);
ALTER TABLE attendance_requests ADD CONSTRAINT attendance_requests_tenant_fk
  FOREIGN KEY(user_id, company_id) REFERENCES users(id, company_id);
ALTER TABLE attendance ADD CONSTRAINT attendance_checkout_coordinates
  CHECK (check_out_time IS NULL OR (check_out_latitude IS NOT NULL AND check_out_longitude IS NOT NULL));
ALTER TABLE sessions ADD CONSTRAINT sessions_expiry_check CHECK (expires_at > created_at);
CREATE INDEX sessions_expiry ON sessions(expires_at);
CREATE INDEX attendance_requests_created ON attendance_requests(created_at);
