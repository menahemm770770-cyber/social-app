const db = require('better-sqlite3')('social.db');
try { db.exec('ALTER TABLE posts ADD COLUMN image TEXT DEFAULT ""'); } catch(e) { console.log('already exists'); }
console.log('done!');