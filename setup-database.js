#!/usr/bin/env node

const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

async function setupDatabase() {
  console.log('🚀 Setting up Ananta Notes database...');

  // Default database connection (you may need to modify these)
  const adminPool = new Pool({
    user: 'postgres',
    host: 'localhost',
    database: 'postgres', // Connect to default postgres database first
    password: 'postgres', // Change this to your PostgreSQL password
    port: 5432,
  });

  try {
    // Check if database exists
    const dbCheck = await adminPool.query(
      "SELECT 1 FROM pg_database WHERE datname = 'ananta_notes'"
    );

    if (dbCheck.rows.length === 0) {
      console.log('📦 Creating ananta_notes database...');
      await adminPool.query('CREATE DATABASE ananta_notes');
      console.log('✅ Database created successfully!');
    } else {
      console.log('✅ Database ananta_notes already exists');
    }

    await adminPool.end();

    // Now connect to the ananta_notes database
    const appPool = new Pool({
      user: 'postgres',
      host: 'localhost',
      database: 'ananta_notes',
      password: 'postgres', // Change this to your PostgreSQL password
      port: 5432,
    });

    // Read and execute the setup script
    const setupScript = fs.readFileSync(
      path.join(__dirname, 'database_setup.sql'),
      'utf8'
    );

    console.log('🏗️  Setting up tables and initial data...');
    await appPool.query(setupScript);
    console.log('✅ Database setup completed successfully!');

    // Test the connection
    const testQuery = await appPool.query('SELECT COUNT(*) as page_count FROM pages');
    console.log(`📄 Database contains ${testQuery.rows[0].page_count} pages`);

    await appPool.end();
    console.log('🎉 Ananta Notes database is ready to use!');

  } catch (error) {
    console.error('❌ Database setup failed:', error.message);
    console.error('📝 Please ensure:');
    console.error('   - PostgreSQL is running');
    console.error('   - Username and password are correct');
    console.error('   - You have permission to create databases');
    process.exit(1);
  }
}

// Run the setup
setupDatabase();
