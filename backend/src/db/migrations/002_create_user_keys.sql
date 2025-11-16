-- Migration 002: Create user encryption keys table
-- This table stores user encryption public keys for content encryption

CREATE TABLE IF NOT EXISTS user_encryption_keys (
    id SERIAL PRIMARY KEY,
    user_address VARCHAR(64) NOT NULL UNIQUE,
    public_key VARCHAR(64) NOT NULL,
    signed_message TEXT, -- sr25519 signature proving ownership of the encryption key
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    device_id VARCHAR(64), -- Optional device identifier for multi-device support
    label VARCHAR(255), -- Optional label for the key (e.g., "Main Device", "Mobile")
    is_active BOOLEAN DEFAULT true,
    metadata JSONB -- Additional metadata if needed
);

-- Create indexes for performance
CREATE INDEX idx_user_encryption_keys_address ON user_encryption_keys(user_address);
CREATE INDEX idx_user_encryption_keys_active ON user_encryption_keys(is_active);
CREATE INDEX idx_user_encryption_keys_created_at ON user_encryption_keys(created_at);

-- Add trigger to update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_user_encryption_keys_updated_at BEFORE UPDATE
    ON user_encryption_keys FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Create table for key rotation history (audit trail)
CREATE TABLE IF NOT EXISTS user_encryption_key_history (
    id SERIAL PRIMARY KEY,
    user_address VARCHAR(64) NOT NULL,
    public_key VARCHAR(64) NOT NULL,
    action VARCHAR(20) NOT NULL, -- 'created', 'rotated', 'revoked'
    reason TEXT,
    previous_public_key VARCHAR(64),
    device_id VARCHAR(64),
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    metadata JSONB
);

-- Create index for history queries
CREATE INDEX idx_user_encryption_key_history_address ON user_encryption_key_history(user_address);
CREATE INDEX idx_user_encryption_key_history_timestamp ON user_encryption_key_history(timestamp);

-- Comments for documentation
COMMENT ON TABLE user_encryption_keys IS 'Stores user X25519 encryption public keys for content encryption';
COMMENT ON COLUMN user_encryption_keys.user_address IS 'Polkadot address of the user';
COMMENT ON COLUMN user_encryption_keys.public_key IS 'X25519 public key (hex encoded) for encryption';
COMMENT ON COLUMN user_encryption_keys.signed_message IS 'sr25519 signature from Polkadot account proving ownership of this encryption key';
COMMENT ON COLUMN user_encryption_keys.device_id IS 'Optional device identifier for multi-device key management';
COMMENT ON COLUMN user_encryption_keys.is_active IS 'Whether this key is currently active for encryption';

COMMENT ON TABLE user_encryption_key_history IS 'Audit trail for encryption key lifecycle events';
COMMENT ON COLUMN user_encryption_key_history.action IS 'Type of action: created, rotated, or revoked';