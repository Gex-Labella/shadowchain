-- Create pending_shadow_items table
CREATE TABLE IF NOT EXISTS pending_shadow_items (
    id SERIAL PRIMARY KEY,
    user_address VARCHAR(64) NOT NULL,
    source VARCHAR(20) NOT NULL CHECK (source IN ('github', 'twitter')),
    original_url TEXT NOT NULL,
    content JSONB NOT NULL, -- Raw content to be stored on blockchain
    timestamp BIGINT NOT NULL,
    tx_data JSONB,
    metadata JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_user_content UNIQUE (user_address, original_url, timestamp)
);

-- Create indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_pending_items_user ON pending_shadow_items(user_address);
CREATE INDEX IF NOT EXISTS idx_pending_items_timestamp ON pending_shadow_items(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_pending_items_created_at ON pending_shadow_items(created_at);