-- Ananta Notes Database Setup Script
-- Run this script to set up the PostgreSQL database for Ananta Notes

-- Create the database (run this as superuser)
-- CREATE DATABASE ananta_notes;

-- Connect to the ananta_notes database before running the rest

-- Create UUID extension for generating UUIDs
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Create pages table
CREATE TABLE IF NOT EXISTS pages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL UNIQUE,
    content TEXT DEFAULT '',
    is_daily_note BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create blocks table for hierarchical note structure
CREATE TABLE IF NOT EXISTS blocks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    page_id UUID REFERENCES pages(id) ON DELETE CASCADE,
    parent_block_id UUID REFERENCES blocks(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    block_order INTEGER DEFAULT 0,
    indent_level INTEGER DEFAULT 0,
    audio_timestamp DECIMAL,
    audio_recording_id UUID,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create audio_recordings table (for future audio features)
CREATE TABLE IF NOT EXISTS audio_recordings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    page_id UUID REFERENCES pages(id) ON DELETE CASCADE,
    data BYTEA,
    duration DECIMAL,
    format TEXT DEFAULT 'wav',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_blocks_page_id ON blocks(page_id);
CREATE INDEX IF NOT EXISTS idx_blocks_parent_id ON blocks(parent_block_id);
CREATE INDEX IF NOT EXISTS idx_blocks_order ON blocks(page_id, block_order);
CREATE INDEX IF NOT EXISTS idx_pages_title ON pages(title);
CREATE INDEX IF NOT EXISTS idx_pages_daily_note ON pages(is_daily_note);

-- Create trigger function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for automatic timestamp updates
CREATE TRIGGER update_pages_updated_at 
    BEFORE UPDATE ON pages 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_blocks_updated_at 
    BEFORE UPDATE ON blocks 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Insert sample data for testing
INSERT INTO pages (title, content, is_daily_note) VALUES 
('Welcome to Ananta', '<h1>Welcome to Ananta Notes</h1><p>This is your first note! Ananta is a powerful note-taking app inspired by Roam Research.</p><ul><li><p>Create hierarchical notes with bullets</p></li><li><p>Link between pages using [[Page Name]] syntax</p></li><li><p>Use daily notes for journaling</p></li><li><p>Audio recording coming soon!</p></li></ul>', false),
('Getting Started', '<h2>Getting Started Guide</h2><ul><li><p>Click "Daily Notes" to create today''s journal entry</p></li><li><p>Use "New Page" to create additional notes</p></li><li><p>Use Tab to indent bullets and Shift+Tab to outdent</p></li><li><p>Try linking to the [[Welcome to Ananta]] page</p></li></ul>', false)
ON CONFLICT (title) DO NOTHING;

-- Create today's daily note if it doesn't exist
INSERT INTO pages (title, content, is_daily_note) VALUES 
(CURRENT_DATE::TEXT, '<h1>' || CURRENT_DATE::TEXT || '</h1><p>Daily Notes for ' || CURRENT_DATE::TEXT || '</p><ul><li><p>What did I accomplish today?</p></li><li><p>What am I grateful for?</p></li><li><p>What are my priorities for tomorrow?</p></li></ul>', true)
ON CONFLICT (title) DO NOTHING;

COMMIT;
