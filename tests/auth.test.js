process.env.JWT_SECRET = 'test-secret';
process.env.TURSO_DATABASE_URL = '';
process.env.TURSO_AUTH_TOKEN = '';
process.env.DB_PATH = './tests/test.sqlite';

const fs = require('fs');
const path = require('path');
const request = require('supertest');

const dbFile = path.resolve('./tests/test.sqlite');
const removeDbFiles = () => {
  for (const f of [dbFile, dbFile + '-wal', dbFile + '-shm', dbFile + '-journal']) {
    try { fs.unlinkSync(f); } catch (e) { /* not there or still locked - harmless */ }
  }
};
removeDbFiles();

const app = require('../server');
const db = require('../db/db');

describe('Auth endpoints', () => {
  const testUser = {
    fullName: 'Test Student',
    studentNumber: '99999',
    email: 'CI.Test@Example.com',
    password: 'Strong1!Pass',
  };

  beforeAll(async () => { await db.ready; });
  afterAll(() => { db.close(); removeDbFiles(); });

  test('registers a new user with a strong password', async () => {
    const res = await request(app).post('/api/auth/register').send(testUser);
    expect(res.statusCode).toBe(201);
    expect(res.body.token).toBeDefined();
  });

  test('rejects a weak password on register', async () => {
    const res = await request(app).post('/api/auth/register').send({ ...testUser, email: 'weak@example.com', password: 'weakpass' });
    expect(res.statusCode).toBe(400);
  });

  test('logs in successfully even with different email casing', async () => {
    const res = await request(app).post('/api/auth/login').send({ email: testUser.email.toLowerCase(), password: testUser.password });
    expect(res.statusCode).toBe(200);
    expect(res.body.token).toBeDefined();
  });

  test('rejects an incorrect password', async () => {
    const res = await request(app).post('/api/auth/login').send({ email: testUser.email, password: 'WrongPassword1!' });
    expect(res.statusCode).toBe(401);
  });

  test('seeded study groups exist and loading them works', async () => {
    const login = await request(app).post('/api/auth/login').send({ email: testUser.email, password: testUser.password });
    const res = await request(app).get('/api/groups').set('Authorization', `Bearer ${login.body.token}`);
    expect(res.statusCode).toBe(200);
    expect(res.body.length).toBe(5);
  });
});