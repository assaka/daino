-- Drop audit_logs table (obsolete - unused functionality)
-- This table was designed for audit trail tracking but is never used
-- and has no Sequelize model. No audit logging is currently implemented.

DROP TABLE IF EXISTS audit_logs CASCADE;
