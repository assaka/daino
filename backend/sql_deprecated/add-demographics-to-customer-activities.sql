-- Database Migration: Add Demographics to Customer Activities
-- Adds country, language, city, region, device info for comprehensive analytics

-- Geographic data
ALTER TABLE customer_activities
ADD COLUMN IF NOT EXISTS country VARCHAR(2);

ALTER TABLE customer_activities
ADD COLUMN IF NOT EXISTS country_name VARCHAR(100);

ALTER TABLE customer_activities
ADD COLUMN IF NOT EXISTS city VARCHAR(100);

ALTER TABLE customer_activities
ADD COLUMN IF NOT EXISTS region VARCHAR(100);

ALTER TABLE customer_activities
ADD COLUMN IF NOT EXISTS language VARCHAR(10);

ALTER TABLE customer_activities
ADD COLUMN IF NOT EXISTS timezone VARCHAR(50);

-- Device and browser data (matching heatmap_sessions schema)
ALTER TABLE customer_activities
ADD COLUMN IF NOT EXISTS device_type VARCHAR(20) CHECK (device_type IN ('desktop', 'tablet', 'mobile'));

ALTER TABLE customer_activities
ADD COLUMN IF NOT EXISTS browser_name VARCHAR(100);

ALTER TABLE customer_activities
ADD COLUMN IF NOT EXISTS operating_system VARCHAR(100);

-- UTM tracking parameters
ALTER TABLE customer_activities
ADD COLUMN IF NOT EXISTS utm_source VARCHAR(255);

ALTER TABLE customer_activities
ADD COLUMN IF NOT EXISTS utm_medium VARCHAR(255);

ALTER TABLE customer_activities
ADD COLUMN IF NOT EXISTS utm_campaign VARCHAR(255);

-- Create indexes for analytics queries
CREATE INDEX IF NOT EXISTS idx_customer_activities_country ON customer_activities(country);

CREATE INDEX IF NOT EXISTS idx_customer_activities_city ON customer_activities(city);

CREATE INDEX IF NOT EXISTS idx_customer_activities_language ON customer_activities(language);

CREATE INDEX IF NOT EXISTS idx_customer_activities_device_type ON customer_activities(device_type);

CREATE INDEX IF NOT EXISTS idx_customer_activities_utm_source ON customer_activities(utm_source);
