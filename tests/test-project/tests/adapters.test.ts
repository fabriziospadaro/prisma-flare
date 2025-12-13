import { describe, it, expect, vi, afterEach } from 'vitest';
import { dbAdapterRegistry as registry, DatabaseAdapter } from 'prisma-flare';
import * as fs from 'fs';
import * as path from 'path';

describe('Database Adapters', () => {
  describe('AdapterRegistry', () => {
    it('should register and retrieve adapters', () => {
      const mockAdapter: DatabaseAdapter = {
        name: 'mock',
        matches: (url) => url.startsWith('mock://'),
        create: vi.fn(),
        drop: vi.fn(),
      };

      registry.register(mockAdapter);
      const adapter = registry.getAdapter('mock://test');
      expect(adapter).toBe(mockAdapter);
    });

    it('should throw error if no adapter found', () => {
      expect(() => registry.getAdapter('unknown://test')).toThrow();
    });

    it('should retrieve default adapters', () => {
      expect(registry.getAdapter('postgresql://localhost:5432/db').name).toBe('postgres');
      expect(registry.getAdapter('file:./dev.db').name).toBe('sqlite');
    });
  });

  describe('SqliteAdapter', () => {
    const testDbPath = path.resolve(__dirname, 'test_adapter.db');
    const testDbUrl = `file:${testDbPath}`;

    afterEach(() => {
      if (fs.existsSync(testDbPath)) {
        fs.unlinkSync(testDbPath);
      }
      // Clean up potential journal files
      if (fs.existsSync(`${testDbPath}-journal`)) fs.unlinkSync(`${testDbPath}-journal`);
      if (fs.existsSync(`${testDbPath}-wal`)) fs.unlinkSync(`${testDbPath}-wal`);
      if (fs.existsSync(`${testDbPath}-shm`)) fs.unlinkSync(`${testDbPath}-shm`);
    });

    it('should match sqlite urls', () => {
      expect(registry.getAdapter('file:./dev.db').name).toBe('sqlite');
    });

    it('should create a sqlite database file', async () => {
      const adapter = registry.getAdapter(testDbUrl);
      await adapter.create(testDbUrl);
      expect(fs.existsSync(testDbPath)).toBe(true);
    });

    it('should drop a sqlite database file', async () => {
      fs.writeFileSync(testDbPath, '');
      const adapter = registry.getAdapter(testDbUrl);
      await adapter.drop(testDbUrl);
      expect(fs.existsSync(testDbPath)).toBe(false);
    });
  });

  describe('PostgresAdapter', () => {
    it('should match postgres urls', () => {
      expect(registry.getAdapter('postgresql://user:pass@localhost:5432/db').name).toBe('postgres');
      expect(registry.getAdapter('postgres://user:pass@localhost:5432/db').name).toBe('postgres');
    });
  });
});
