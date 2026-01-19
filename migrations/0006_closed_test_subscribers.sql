-- Migration number: 0006 	 2026-01-19T00:00:00.000Z
CREATE TABLE IF NOT EXISTS closed_test_subscribers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT NOT NULL,
    platform TEXT CHECK (platform IN ('iOS', 'Android')) DEFAULT 'Android',
    requested_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected'))
);
