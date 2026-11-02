PRAGMA foreign_keys=ON;
CREATE TABLE IF NOT EXISTS users (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 email TEXT NOT NULL UNIQUE,
 password_hash TEXT NOT NULL,
 created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS profiles (
 user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
 display_name TEXT NOT NULL DEFAULT '',
 age INTEGER,
 height_cm REAL,
 weight_kg REAL,
 target_kg REAL,
 goal TEXT NOT NULL DEFAULT 'salud',
 experience TEXT NOT NULL DEFAULT 'principiante',
 weekly_days INTEGER NOT NULL DEFAULT 3,
 minutes INTEGER NOT NULL DEFAULT 20,
 equipment TEXT NOT NULL DEFAULT 'ninguno',
 pushups TEXT NOT NULL DEFAULT '0',
 squats TEXT NOT NULL DEFAULT '0',
 allergies TEXT NOT NULL DEFAULT '[]',
 health_flags TEXT NOT NULL DEFAULT '[]',
 avoid_foods TEXT NOT NULL DEFAULT '[]',
 updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS measurements (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 weight_kg REAL NOT NULL,
 waist_cm REAL,
 note TEXT NOT NULL DEFAULT '',
 date TEXT NOT NULL,
 created_at TEXT NOT NULL DEFAULT (datetime('now')),
 UNIQUE(user_id,date)
);
CREATE TABLE IF NOT EXISTS workout_logs (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 day TEXT NOT NULL,
 type TEXT NOT NULL,
 minutes INTEGER NOT NULL,
 rpe INTEGER NOT NULL,
 exercises TEXT NOT NULL DEFAULT '[]',
 created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS pantry (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 ingredient TEXT NOT NULL,
 quantity TEXT NOT NULL DEFAULT '',
 created_at TEXT NOT NULL DEFAULT (datetime('now')),
 UNIQUE(user_id,ingredient)
);
CREATE TABLE IF NOT EXISTS meal_logs (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 day TEXT NOT NULL,
 meal_type TEXT NOT NULL,
 description TEXT NOT NULL,
 created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS habits (
 user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 day TEXT NOT NULL,
 water INTEGER NOT NULL DEFAULT 0,
 sleep REAL,
 steps INTEGER,
 PRIMARY KEY(user_id,day)
);
CREATE TABLE IF NOT EXISTS login_attempts (
 fingerprint TEXT PRIMARY KEY,
 attempts INTEGER NOT NULL DEFAULT 0,
 last_attempt INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_measurements_user_date ON measurements(user_id,date);
CREATE INDEX IF NOT EXISTS idx_workouts_user_day ON workout_logs(user_id,day);
CREATE INDEX IF NOT EXISTS idx_meals_user_day ON meal_logs(user_id,day);
CREATE TABLE IF NOT EXISTS ai_usage (
 user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 day TEXT NOT NULL,
 attempts INTEGER NOT NULL DEFAULT 0,
 PRIMARY KEY(user_id,day)
);
