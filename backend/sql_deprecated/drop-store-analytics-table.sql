-- Drop store_analytics table (obsolete - unused functionality)
-- This table was designed for aggregated analytics but is never queried
-- and has no Sequelize model. Data is already tracked in usage_metrics.

DROP TABLE IF EXISTS store_analytics CASCADE;
