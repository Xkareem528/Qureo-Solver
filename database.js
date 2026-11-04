const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL
    ? { rejectUnauthorized: false }
    : false
});

pool.on('error', err => {
  console.error('PostgreSQL error:', err.message);
});

async function initDatabase() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS chapters (
      id SERIAL PRIMARY KEY,
      title TEXT NOT NULL,
      description TEXT,
      order_index INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS questions (
      id SERIAL PRIMARY KEY,
      chapter_id INTEGER REFERENCES chapters(id),
      question_text TEXT NOT NULL,
      options_json TEXT NOT NULL,
      correct_answer TEXT NOT NULL,
      normalized_hash TEXT UNIQUE NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS progress (
      id SERIAL PRIMARY KEY,
      chapter_id INTEGER UNIQUE REFERENCES chapters(id),
      completed_questions INTEGER DEFAULT 0,
      total_questions INTEGER DEFAULT 0,
      status TEXT DEFAULT 'In Progress',
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);

  const result = await pool.query(
    'SELECT COUNT(*) AS n FROM chapters'
  );

  if (Number(result.rows[0].n) === 0) {
    for (let i = 1; i <= 42; i++) {
      await pool.query(
        `INSERT INTO chapters (title, description, order_index)
         VALUES ($1, $2, $3)`,
        [
          `الفصل ${i}`,
          'فصل تجريبي — أضف بياناته عند توفرها',
          i
        ]
      );
    }
  }

  console.log('PostgreSQL database initialized');
}

module.exports = { pool, initDatabase };
