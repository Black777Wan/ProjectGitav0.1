const { Pool } = require('pg');
const { v4: uuidv4 } = require('uuid');

class DatabaseManager {
  constructor() {
    this.pool = new Pool({
      user: 'postgres',
      host: 'localhost',
      database: 'ananta_notes',
      password: 'postgres', // Change this to your PostgreSQL password
      port: 5432,
    });
  }

  async initialize() {
    try {
      // Create tables if they don't exist
      await this.createTables();
    } catch (error) {
      console.error('Database initialization error:', error);
      throw error;
    }
  }

  async createTables() {
    const client = await this.pool.connect();
    try {
      // Create pages table
      await client.query(`
        CREATE TABLE IF NOT EXISTS pages (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          title TEXT NOT NULL UNIQUE,
          content TEXT DEFAULT '',
          is_daily_note BOOLEAN DEFAULT FALSE,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);

      // Create blocks table
      await client.query(`
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
        )
      `);

      // Create audio_recordings table (for future use)
      await client.query(`
        CREATE TABLE IF NOT EXISTS audio_recordings (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          page_id UUID REFERENCES pages(id) ON DELETE CASCADE,
          data BYTEA,
          duration DECIMAL,
          format TEXT DEFAULT 'wav',
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);

      // Create indexes for better performance
      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_blocks_page_id ON blocks(page_id);
        CREATE INDEX IF NOT EXISTS idx_blocks_parent_id ON blocks(parent_block_id);
        CREATE INDEX IF NOT EXISTS idx_blocks_order ON blocks(page_id, block_order);
        CREATE INDEX IF NOT EXISTS idx_pages_title ON pages(title);
        CREATE INDEX IF NOT EXISTS idx_pages_daily_note ON pages(is_daily_note);
      `);

    } finally {
      client.release();
    }
  }

  // Page operations
  async getPages() {
    const result = await this.pool.query(
      'SELECT * FROM pages ORDER BY updated_at DESC'
    );
    return result.rows;
  }

  async getPage(pageId) {
    const result = await this.pool.query(
      'SELECT * FROM pages WHERE id = $1',
      [pageId]
    );
    return result.rows[0];
  }

  async getPageByTitle(title) {
    const result = await this.pool.query(
      'SELECT * FROM pages WHERE title = $1',
      [title]
    );
    return result.rows[0];
  }

  async createPage(pageData) {
    const { title, content = '', isDailyNote = false } = pageData;
    const id = uuidv4();
    
    const result = await this.pool.query(
      `INSERT INTO pages (id, title, content, is_daily_note, created_at, updated_at) 
       VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP) 
       RETURNING *`,
      [id, title, content, isDailyNote]
    );
    return result.rows[0];
  }

  async updatePage(pageId, pageData) {
    const { title, content } = pageData;
    const result = await this.pool.query(
      `UPDATE pages SET title = $1, content = $2, updated_at = CURRENT_TIMESTAMP 
       WHERE id = $3 RETURNING *`,
      [title, content, pageId]
    );
    return result.rows[0];
  }

  // Block operations
  async getBlocks(pageId) {
    const result = await this.pool.query(
      `SELECT * FROM blocks WHERE page_id = $1 
       ORDER BY block_order ASC, created_at ASC`,
      [pageId]
    );
    return result.rows;
  }

  async createBlock(blockData) {
    const { 
      pageId, 
      parentBlockId = null, 
      content, 
      blockOrder = 0, 
      indentLevel = 0 
    } = blockData;
    const id = uuidv4();
    
    const result = await this.pool.query(
      `INSERT INTO blocks (id, page_id, parent_block_id, content, block_order, indent_level, created_at, updated_at) 
       VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP) 
       RETURNING *`,
      [id, pageId, parentBlockId, content, blockOrder, indentLevel]
    );
    return result.rows[0];
  }

  async updateBlock(blockId, blockData) {
    const { content, blockOrder, indentLevel } = blockData;
    const result = await this.pool.query(
      `UPDATE blocks SET content = $1, block_order = $2, indent_level = $3, updated_at = CURRENT_TIMESTAMP 
       WHERE id = $4 RETURNING *`,
      [content, blockOrder, indentLevel, blockId]
    );
    return result.rows[0];
  }

  async deleteBlock(blockId) {
    const result = await this.pool.query(
      'DELETE FROM blocks WHERE id = $1 RETURNING *',
      [blockId]
    );
    return result.rows[0];
  }

  // Daily note operations
  async getDailyNote(date) {
    const title = date; // date should be in YYYY-MM-DD format
    
    // Try to find existing daily note
    let page = await this.getPageByTitle(title);
    
    // If not found, create it
    if (!page) {
      page = await this.createPage({
        title,
        content: `# ${title}\n\nDaily Notes for ${date}`,
        isDailyNote: true
      });
    }
    
    return page;
  }
}

module.exports = { DatabaseManager };
