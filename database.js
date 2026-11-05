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

  await pool.query(`
    CREATE TABLE IF NOT EXISTS source_questions (
      id BIGSERIAL PRIMARY KEY,
      fingerprint TEXT UNIQUE NOT NULL,
      level INTEGER NOT NULL,
      lesson TEXT,
      question_label TEXT,
      question_text TEXT NOT NULL,
      original_answer TEXT,
      original_answer_type TEXT NOT NULL,
      proposed_answer TEXT,
      proposed_answer_type TEXT,
      has_answer_marker BOOLEAN NOT NULL DEFAULT FALSE,
      source_line INTEGER NOT NULL,
      source_file TEXT NOT NULL,
      review_status TEXT NOT NULL DEFAULT 'pending',
      imported_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT valid_review_status CHECK (
        review_status IN (
          'pending',
          'classified_not_verified',
          'verified',
          'rejected'
        )
      )
    );

    CREATE INDEX IF NOT EXISTS idx_source_questions_level
      ON source_questions(level);

    CREATE INDEX IF NOT EXISTS idx_source_questions_review
      ON source_questions(review_status);
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
