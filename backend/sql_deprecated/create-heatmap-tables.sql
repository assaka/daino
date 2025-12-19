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
    time_on_element INTEGER, -- milliseconds
    device_type VARCHAR(20) CHECK (device_type IN ('desktop', 'tablet', 'mobile')),
    user_agent TEXT,
    ip_address INET,
    timestamp_utc TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create heatmap aggregated data for performance
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
    device_breakdown JSONB DEFAULT '{}'::jsonb, -- {"desktop": 50, "mobile": 30, "tablet": 20}
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE(store_id, page_url, aggregation_period, period_start, viewport_width, viewport_height, interaction_type, x_coordinate, y_coordinate)
);

-- Create heatmap sessions for visitor flow tracking
CREATE TABLE IF NOT EXISTS heatmap_sessions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    session_id VARCHAR(255) NOT NULL,
    store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
    user_id UUID NULL REFERENCES users(id) ON DELETE SET NULL,
    first_page_url TEXT,
    last_page_url TEXT,
    session_start TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    session_end TIMESTAMP WITH TIME ZONE,
    total_duration INTEGER, -- seconds
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

-- Create indexes for performance
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

-- Create trigger to update updated_at timestamp
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