// Loaded before every test file (node --import). Cross-platform replacement
// for `NODE_ENV=test DATABASE_URL=... node --test` (which fails on Windows cmd).
// The dummy DATABASE_URL only satisfies @workspace/db's import-time check; unit
// tests never query it. DB integration tests need TEST_DATABASE_URL.
process.env.NODE_ENV = "test";
process.env.DATABASE_URL ??= "postgres://test:test@127.0.0.1:5432/test";
