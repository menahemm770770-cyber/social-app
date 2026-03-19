const express = require('express');
const Database = require('better-sqlite3');
const bcrypt = require('bcryptjs');
const session = require('express-session');

const app = express();
const PORT = 3000;
const db = new Database('social.db');

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    bio TEXT DEFAULT '',
    avatar TEXT DEFAULT '',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS posts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    author TEXT NOT NULL,
    content TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS likes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    post_id INTEGER NOT NULL,
    username TEXT NOT NULL,
    UNIQUE(post_id, username)
  );
  CREATE TABLE IF NOT EXISTS comments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    post_id INTEGER NOT NULL,
    author TEXT NOT NULL,
    content TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);

app.use(express.static('.'));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));
app.use(session({
  secret: 'my-secret-key-123',
  resave: false,
  saveUninitialized: false
}));

app.post('/api/register', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ error: 'חסרים פרטים' });
  const exists = db.prepare('SELECT id FROM users WHERE username = ?').get(username);
  if (exists) return res.status(400).json({ error: 'שם המשתמש תפוס' });
  const hash = bcrypt.hashSync(password, 10);
  db.prepare('INSERT INTO users (username, password) VALUES (?, ?)').run(username, hash);
  res.json({ success: true });
});

app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username);
  if (!user) return res.status(400).json({ error: 'משתמש לא קיים' });
  const valid = bcrypt.compareSync(password, user.password);
  if (!valid) return res.status(400).json({ error: 'סיסמה שגויה' });
  req.session.user = { id: user.id, username: user.username };
  res.json({ success: true, username: user.username });
});

app.post('/api/logout', (req, res) => {
  req.session.destroy();
  res.json({ success: true });
});

app.get('/api/me', (req, res) => {
  if (req.session.user) {
    res.json({ user: req.session.user });
  } else {
    res.json({ user: null });
  }
});

app.get('/api/posts', (req, res) => {
  const posts = db.prepare('SELECT * FROM posts ORDER BY id DESC').all();
  res.json(posts);
});
app.post('/api/posts', (req, res) => {
  if (!req.session.user) return res.status(401).json({ error: 'לא מחובר' });
  const { content, image } = req.body;
  if (!content && !image) return res.status(400).json({ error: 'תוכן חסר' });
  const result = db.prepare('INSERT INTO posts (author, content, image) VALUES (?, ?, ?)').run(req.session.user.username, content, image || '');
  const post = db.prepare('SELECT * FROM posts WHERE id = ?').get(result.lastInsertRowid);
  res.json(post);
});

app.get('/api/posts/:id/likes', (req, res) => {
  const postId = req.params.id;
  const count = db.prepare('SELECT COUNT(*) as count FROM likes WHERE post_id = ?').get(postId);
  const username = req.session.user ? req.session.user.username : null;
  const liked = username ? !!db.prepare('SELECT id FROM likes WHERE post_id = ? AND username = ?').get(postId, username) : false;
  res.json({ count: count.count, liked });
});

app.get('/api/posts/:id/comments', (req, res) => {
  const comments = db.prepare('SELECT * FROM comments WHERE post_id = ? ORDER BY id ASC').all(req.params.id);
  res.json(comments);
});

app.post('/api/posts/:id/comments', (req, res) => {
  if (!req.session.user) return res.status(401).json({ error: 'לא מחובר' });
  const { content } = req.body;
  if (!content) return res.status(400).json({ error: 'תוכן חסר' });
  db.prepare('INSERT INTO comments (post_id, author, content) VALUES (?, ?, ?)').run(req.params.id, req.session.user.username, content);
  res.json({ success: true });
});
app.get('/api/profile/:username', (req, res) => {
  const user = db.prepare('SELECT id, username, bio, avatar, created_at FROM users WHERE username = ?').get(req.params.username);
  if (!user) return res.status(404).json({ error: 'משתמש לא נמצא' });
  const posts = db.prepare('SELECT COUNT(*) as count FROM posts WHERE author = ?').get(req.params.username);
  res.json({ ...user, postCount: posts.count });
});

app.post('/api/profile', (req, res) => {
  if (!req.session.user) return res.status(401).json({ error: 'לא מחובר' });
  const { bio } = req.body;
  db.prepare('UPDATE users SET bio = ? WHERE id = ?').run(bio, req.session.user.id);
  res.json({ success: true });
});

app.post('/api/avatar', (req, res) => {
  if (!req.session.user) return res.status(401).json({ error: 'לא מחובר' });
  const { avatar } = req.body;
  db.prepare('UPDATE users SET avatar = ? WHERE id = ?').run(avatar, req.session.user.id);
  res.json({ success: true });
});
app.listen(PORT, () => {
  console.log('השרת רץ על http://localhost:3000');
});