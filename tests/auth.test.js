process.env.JWT_SECRET = 'test-secret';
process.env.DB_PATH = require('path').join(__dirname, 'test.sqlite');

const fs = require('fs');
const request = require('supertest');

const dbFile = process.env.DB_PATH;
if (fs.existsSync(dbFile)) fs.unlinkSync(dbFile);

const app = require('../server');
const db = require('../db/db');

describe('Auth endpoints', () => {
  const testUser = {
    fullName: 'Test Student',
    studentNumber: '99999',
    email: 'CI.Test@Example.com',
    password: 'Strong1!Pass',
  };

  afterAll(() => {
    // better-sqlite3 keeps the file open, and Windows (unlike Linux/Mac)
    // refuses to delete a file that's still open — close the connection
    // first so cleanup doesn't fail the whole suite on Windows.
    db.close();
    try {
      if (fs.existsSync(dbFile)) fs.unlinkSync(dbFile);
    } catch (err) {
      // Non-fatal: a leftover test.sqlite file is harmless and gets
      // overwritten next run anyway.
    }
  });

  test('registers a new user with a strong password', async () => {
    const res = await request(app).post('/api/auth/register').send(testUser);
    expect(res.statusCode).toBe(201);
    expect(res.body.token).toBeDefined();
  });

  test('rejects a weak password on register', async () => {
    const res = await request(app).post('/api/auth/register').send({
      ...testUser,
      email: 'weak@example.com',
      password: 'weakpass',
    });
    expect(res.statusCode).toBe(400);
  });

  test('logs in successfully even with different email casing', async () => {
    const res = await request(app).post('/api/auth/login').send({
      email: testUser.email.toLowerCase(),
      password: testUser.password,
    });
    expect(res.statusCode).toBe(200);
    expect(res.body.token).toBeDefined();
  });

  test('rejects an incorrect password', async () => {
    const res = await request(app).post('/api/auth/login').send({
      email: testUser.email,
      password: 'WrongPassword1!',
    });
    expect(res.statusCode).toBe(401);
  });
});