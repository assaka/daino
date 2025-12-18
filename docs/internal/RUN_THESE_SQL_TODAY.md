# SQL Migrations to Run Today (2025-11-07)

## ⚠️ CRITICAL FIRST: Restore Translations Table

Before running anything else, restore your translations table from Supabase backup!

## 1. Analytics & Heatmap Tables (Run These in Supabase SQL Editor)

These tables were created in code today but need to exist in your Supabase database:

### A. Heatmap Tables (from `create-heatmap-tables.sql`)

```sql
-- Create heatmap interaction tracking table
CREATE TABLE IF NOT EXISTS heatmap_interactions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    session_id VARCHAR(255) NOT NULL,
    store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
    user_id UUID NULL REFERENCES users(id) ON DELETE SET NULL,
    page_url TEXT NOT NULL,
    page_title VARCHAR(500),
    viewport_width INTEGER NOT NULL,
    viewport_height INTEGER NOT NULL,
    interaction_type VARCHAR(50) NOT NULL CHECK (interaction_type IN (
        'click', 'hover', 'scroll', 'mouse_move', 'touch', 'focus', 'key_press'
    )),
    x_coordinate INTEGER,
    y_coordinate INTEGER,
    element_selector TEXT,
    element_tag VARCHAR(50),
    element_id VARCHAR(255),
    element_class VARCHAR(500),
    element_text TEXT,
    scroll_position INTEGER,
    scroll_depth_percent DECIMAL(5,2),
    time_on_element INTEGER,
    device_type VARCHAR(20) CHECK (device_type IN ('desktop', 'tablet', 'mobile')),
    user_agent TEXT,
    ip_address INET,
    timestamp_utc TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS heatmap_aggregations (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
    page_url TEXT NOT NULL,
    aggregation_period VARCHAR(20) NOT NULL CHECK (aggregation_period IN ('hourly', 'daily', 'weekly')),
    period_start TIMESTAMP WITH TIME ZONE NOT NULL,
    period_end TIMESTAMP WITH TIME ZONE NOT NULL,
    viewport_width INTEGER NOT NULL,
    viewport_height INTEGER NOT NULL,
    interaction_type VARCHAR(50) NOT NULL,
    x_coordinate INTEGER NOT NULL,
    y_coordinate INTEGER NOT NULL,
    interaction_count INTEGER NOT NULL DEFAULT 1,
    unique_sessions INTEGER NOT NULL DEFAULT 1,
    avg_time_on_element DECIMAL(10,2),
    device_breakdown JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(store_id, page_url, aggregation_period, period_start, viewport_width, viewport_height, interaction_type, x_coordinate, y_coordinate)
);

CREATE TABLE IF NOT EXISTS heatmap_sessions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    session_id VARCHAR(255) NOT NULL,
    store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
    user_id UUID NULL REFERENCES users(id) ON DELETE SET NULL,
    first_page_url TEXT,
    last_page_url TEXT,
    session_start TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    session_end TIMESTAMP WITH TIME ZONE,
    total_duration INTEGER,
    page_count INTEGER DEFAULT 1,
    interaction_count INTEGER DEFAULT 0,
    bounce_session BOOLEAN DEFAULT FALSE,
    conversion_session BOOLEAN DEFAULT FALSE,
    device_type VARCHAR(20) CHECK (device_type IN ('desktop', 'tablet', 'mobile')),
    browser_name VARCHAR(100),
    operating_system VARCHAR(100),
    referrer_url TEXT,
    utm_source VARCHAR(255),
    utm_medium VARCHAR(255),
    utm_campaign VARCHAR(255),
    country VARCHAR(100),
    region VARCHAR(100),
    city VARCHAR(100),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(session_id, store_id)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_heatmap_interactions_store_page_time
ON heatmap_interactions(store_id, page_url, timestamp_utc DESC);

CREATE INDEX IF NOT EXISTS idx_heatmap_interactions_session
ON heatmap_interactions(session_id);

CREATE INDEX IF NOT EXISTS idx_heatmap_interactions_coordinates
ON heatmap_interactions(store_id, page_url, interaction_type, x_coordinate, y_coordinate);

CREATE INDEX IF NOT EXISTS idx_heatmap_interactions_viewport
ON heatmap_interactions(viewport_width, viewport_height);

CREATE INDEX IF NOT EXISTS idx_heatmap_aggregations_lookup
ON heatmap_aggregations(store_id, page_url, aggregation_period, period_start);

CREATE INDEX IF NOT EXISTS idx_heatmap_sessions_store_time
ON heatmap_sessions(store_id, session_start DESC);

CREATE INDEX IF NOT EXISTS idx_heatmap_sessions_session_id
ON heatmap_sessions(session_id);

-- Create triggers
CREATE OR REPLACE FUNCTION update_heatmap_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_heatmap_interactions_timestamp
    BEFORE UPDATE ON heatmap_interactions
    FOR EACH ROW EXECUTE FUNCTION update_heatmap_timestamp();

CREATE TRIGGER update_heatmap_aggregations_timestamp
    BEFORE UPDATE ON heatmap_aggregations
    FOR EACH ROW EXECUTE FUNCTION update_heatmap_timestamp();

CREATE TRIGGER update_heatmap_sessions_timestamp
    BEFORE UPDATE ON heatmap_sessions
    FOR EACH ROW EXECUTE FUNCTION update_heatmap_timestamp();
```

### B. A/B Testing Tables

```sql
CREATE TABLE IF NOT EXISTS ab_tests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    hypothesis TEXT,
    status VARCHAR(50) DEFAULT 'draft' CHECK (status IN ('draft', 'running', 'paused', 'completed', 'archived')),
    variants JSONB NOT NULL DEFAULT '[]',
    traffic_allocation FLOAT DEFAULT 1.0 CHECK (traffic_allocation >= 0.0 AND traffic_allocation <= 1.0),
    targeting_rules JSONB,
    primary_metric VARCHAR(255) NOT NULL,
    secondary_metrics JSONB DEFAULT '[]',
    start_date TIMESTAMP,
    end_date TIMESTAMP,
    min_sample_size INTEGER DEFAULT 100,
    confidence_level FLOAT DEFAULT 0.95,
    winner_variant_id VARCHAR(255),
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS ab_test_assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    test_id UUID NOT NULL REFERENCES ab_tests(id) ON DELETE CASCADE,
    store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
    session_id VARCHAR(255) NOT NULL,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    variant_id VARCHAR(255) NOT NULL,
    variant_name VARCHAR(255) NOT NULL,
    assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    converted BOOLEAN DEFAULT FALSE,
    converted_at TIMESTAMP,
    conversion_value DECIMAL(10, 2),
    metrics JSONB DEFAULT '{}',
    device_type VARCHAR(50),
    user_agent TEXT,
    ip_address VARCHAR(45),
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_test_session UNIQUE (test_id, session_id)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_ab_tests_store_id ON ab_tests(store_id);
CREATE INDEX IF NOT EXISTS idx_ab_tests_status ON ab_tests(status);
CREATE INDEX IF NOT EXISTS idx_ab_tests_start_date ON ab_tests(start_date);
CREATE INDEX IF NOT EXISTS idx_ab_tests_end_date ON ab_tests(end_date);
CREATE INDEX IF NOT EXISTS idx_ab_assignments_test_id ON ab_test_assignments(test_id);
CREATE INDEX IF NOT EXISTS idx_ab_assignments_store_id ON ab_test_assignments(store_id);
CREATE INDEX IF NOT EXISTS idx_ab_assignments_session_id ON ab_test_assignments(session_id);
CREATE INDEX IF NOT EXISTS idx_ab_assignments_user_id ON ab_test_assignments(user_id);
CREATE INDEX IF NOT EXISTS idx_ab_assignments_variant_id ON ab_test_assignments(variant_id);
CREATE INDEX IF NOT EXISTS idx_ab_assignments_converted ON ab_test_assignments(converted);
CREATE INDEX IF NOT EXISTS idx_ab_assignments_assigned_at ON ab_test_assignments(assigned_at);

-- Create triggers
CREATE TRIGGER update_ab_tests_updated_at
    BEFORE UPDATE ON ab_tests
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_ab_assignments_updated_at
    BEFORE UPDATE ON ab_test_assignments
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
```

### C. Custom Analytics Events Table

**IMPORTANT**: If you're getting errors about null value constraint violations, run this fix FIRST:

```sql
-- FIX: Add missing DEFAULT constraints to all columns
ALTER TABLE custom_analytics_events
ALTER COLUMN id SET DEFAULT gen_random_uuid();

ALTER TABLE custom_analytics_events
ALTER COLUMN created_at SET DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE custom_analytics_events
ALTER COLUMN updated_at SET DEFAULT CURRENT_TIMESTAMP;

-- Clean up any failed rows with NULL values
DELETE FROM custom_analytics_events WHERE id IS NULL OR created_at IS NULL OR updated_at IS NULL;
```

**Fresh Installation** (if table doesn't exist yet):

```sql
CREATE TABLE IF NOT EXISTS custom_analytics_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
    event_name VARCHAR(255) NOT NULL,
    display_name VARCHAR(255) NOT NULL,
    description TEXT,
    event_category VARCHAR(50) DEFAULT 'custom' CHECK (event_category IN ('ecommerce', 'engagement', 'conversion', 'navigation', 'custom')),
    trigger_type VARCHAR(50) NOT NULL CHECK (trigger_type IN ('page_load', 'click', 'form_submit', 'scroll', 'timer', 'custom', 'automatic')),
    trigger_selector VARCHAR(500),
    trigger_condition JSONB,
    event_parameters JSONB NOT NULL DEFAULT '{}',
    enabled BOOLEAN DEFAULT TRUE,
    priority INTEGER DEFAULT 10,
    is_system BOOLEAN DEFAULT FALSE,
    fire_once_per_session BOOLEAN DEFAULT FALSE,
    send_to_backend BOOLEAN DEFAULT TRUE,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_custom_events_store_id ON custom_analytics_events(store_id);
CREATE INDEX IF NOT EXISTS idx_custom_events_enabled ON custom_analytics_events(enabled);
CREATE INDEX IF NOT EXISTS idx_custom_events_trigger_type ON custom_analytics_events(trigger_type);
CREATE INDEX IF NOT EXISTS idx_custom_events_category ON custom_analytics_events(event_category);
CREATE INDEX IF NOT EXISTS idx_custom_events_priority ON custom_analytics_events(priority);

CREATE TRIGGER update_custom_events_updated_at
    BEFORE UPDATE ON custom_analytics_events
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Insert default page_view event for all stores
INSERT INTO custom_analytics_events (store_id, event_name, display_name, description, event_category, trigger_type, event_parameters, is_system, enabled)
SELECT
    id,
    'page_view',
    'Page View',
    'Tracks when a user views any page',
    'navigation',
    'page_load',
    '{"page_title": "{{page_title}}", "page_url": "{{page_url}}"}'::jsonb,
    TRUE,
    TRUE
FROM stores
ON CONFLICT DO NOTHING;
```

### D. Customer Activities Demographics & Device Tracking

Add comprehensive demographic, device, and marketing data to customer_activities:

```sql
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

-- Device and browser data
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
```

## 2. Translations Table Fix (AFTER RESTORING FROM BACKUP)

After you restore translations from Supabase backup, run this corrected migration:

```sql
-- Step 1: Check current state
SELECT column_name, is_nullable FROM information_schema.columns
WHERE table_name = 'translations' AND column_name IN ('key', 'language_code', 'store_id');

-- Step 2: Add store_id if missing
ALTER TABLE translations ADD COLUMN IF NOT EXISTS store_id UUID REFERENCES stores(id);

-- Step 3: Drop old index FIRST
DROP INDEX IF EXISTS translations_key_language_unique;

-- Step 4: Copy translations to all stores
DO $$
DECLARE
    store_record RECORD;
    inserted INTEGER := 0;
BEGIN
    FOR store_record IN SELECT id, name FROM stores LOOP
        INSERT INTO translations (id, store_id, key, language_code, value, category, type, created_at, updated_at)
        SELECT gen_random_uuid(), store_record.id, key, language_code, value, category, type, NOW(), NOW()
        FROM translations WHERE store_id IS NULL
        ON CONFLICT DO NOTHING;

        GET DIAGNOSTICS inserted = ROW_COUNT;
        RAISE NOTICE 'Store %: % rows inserted', store_record.name, inserted;
    END LOOP;
END $$;

-- Step 5: VERIFY before deleting
SELECT s.name, COUNT(t.id) as count
FROM stores s
LEFT JOIN translations t ON t.store_id = s.id
GROUP BY s.id, s.name;

-- Step 6: Only if Step 5 shows data
DELETE FROM translations WHERE store_id IS NULL;

-- Step 7: Make required
ALTER TABLE translations ALTER COLUMN store_id SET NOT NULL;

-- Step 8: New indexes
CREATE UNIQUE INDEX translations_store_key_language_unique ON translations(store_id, key, language_code);
CREATE INDEX translations_store_id_index ON translations(store_id);
```

## Execution Order

1. **FIRST**: Restore translations from Supabase backup (Dashboard → Backups → Point-in-Time)
2. **SECOND**: Run analytics tables SQL (Section 1.A, 1.B, 1.C above)
3. **THIRD**: Run corrected translations migration (Section 2 above)

## Verify Each Step

```sql
-- Check heatmap tables exist
SELECT table_name FROM information_schema.tables
WHERE table_name IN ('heatmap_interactions', 'heatmap_sessions', 'heatmap_aggregations', 'ab_tests', 'ab_test_assignments', 'custom_analytics_events');

-- Check translations table structure
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'translations'
ORDER BY ordinal_position;

-- Check translations have store_id values
SELECT COUNT(*) as total, COUNT(store_id) as with_store_id
FROM translations;
```
