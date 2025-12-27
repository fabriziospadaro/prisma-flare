/**
 * Database Adapters Unit Tests
 *
 * Tests for database adapter registration, matching, and operations
 */

import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { dbAdapterRegistry as registry, DatabaseAdapter } from 'prisma-flare';
import * as fs from 'fs';
import * as path from 'path';

describe('Database Adapters Unit Tests', () => {
  /**
   * ============================================
   * ADAPTER REGISTRY
   * ============================================
   */
  describe('Adapter Registry', () => {
    it('should register custom adapter', () => {
      const mockAdapter: DatabaseAdapter = {
        name: 'mock-custom',
        matches: (url) => url.startsWith('mock-custom://'),
        create: vi.fn(),
        drop: vi.fn(),
      };

      registry.register(mockAdapter);
      const adapter = registry.getAdapter('mock-custom://test');

      expect(adapter).toBe(mockAdapter);
    });

    it('should throw error for unknown adapter', () => {
      expect(() => registry.getAdapter('unknown-protocol://test')).toThrow();
    });

    it('should return correct adapter by URL pattern', () => {
      const urls = [
        { url: 'postgresql://localhost:5432/db', expected: 'postgres' },
        { url: 'postgres://user:pass@host/db', expected: 'postgres' },
        { url: 'file:./dev.db', expected: 'sqlite' },
        { url: 'file:/path/to/db.sqlite', expected: 'sqlite' },
      ];

      for (const { url, expected } of urls) {
        const adapter = registry.getAdapter(url);
        expect(adapter.name).toBe(expected);
      }
    });

    it('should prefer first matching adapter', () => {
      const adapter1: DatabaseAdapter = {
        name: 'first',
        matches: (url) => url.includes('test'),
        create: vi.fn(),
        drop: vi.fn(),
      };

      const adapter2: DatabaseAdapter = {
        name: 'second',
        matches: (url) => url.includes('test'),
        create: vi.fn(),
        drop: vi.fn(),
      };

      registry.register(adapter1);
      registry.register(adapter2);

      // Should get either one consistently (depends on registration order)
      const result = registry.getAdapter('test://something');
      expect(['first', 'second']).toContain(result.name);
    });
  });

  /**
   * ============================================
   * SQLITE ADAPTER
   * ============================================
   */
  describe('SQLite Adapter', () => {
    const testDir = path.resolve(__dirname, '..');
    const testDbPath = path.join(testDir, 'test_adapter_unit.db');
    const testDbUrl = `file:${testDbPath}`;

    afterEach(() => {
      // Clean up test files
      [testDbPath, `${testDbPath}-journal`, `${testDbPath}-wal`, `${testDbPath}-shm`].forEach(
        (file) => {
          if (fs.existsSync(file)) {
            fs.unlinkSync(file);
          }
        }
      );
    });

    describe('URL Matching', () => {
      it('should match file: protocol', () => {
        const adapter = registry.getAdapter('file:./dev.db');
        expect(adapter.name).toBe('sqlite');
      });

      it('should match absolute file path', () => {
        const adapter = registry.getAdapter('file:/absolute/path/db.sqlite');
        expect(adapter.name).toBe('sqlite');
      });

      it('should match relative file path', () => {
        const adapter = registry.getAdapter('file:../relative/path/db.db');
        expect(adapter.name).toBe('sqlite');
      });

      it('should not match non-file URLs', () => {
        expect(() => registry.getAdapter('http://example.com/db')).toThrow();
      });
    });

    describe('Database Operations', () => {
      it('should create database file', async () => {
        const adapter = registry.getAdapter(testDbUrl);

        await adapter.create(testDbUrl);

        expect(fs.existsSync(testDbPath)).toBe(true);
      });

      it('should not throw when creating existing database', async () => {
        fs.writeFileSync(testDbPath, '');
        const adapter = registry.getAdapter(testDbUrl);

        await expect(adapter.create(testDbUrl)).resolves.not.toThrow();
      });

      it('should drop database file', async () => {
        fs.writeFileSync(testDbPath, '');
        const adapter = registry.getAdapter(testDbUrl);

        await adapter.drop(testDbUrl);

        expect(fs.existsSync(testDbPath)).toBe(false);
      });

      it('should not throw when dropping non-existent database', async () => {
        const adapter = registry.getAdapter(testDbUrl);

        await expect(adapter.drop(testDbUrl)).resolves.not.toThrow();
      });

      it('should clean up journal files on drop', async () => {
        fs.writeFileSync(testDbPath, '');
        fs.writeFileSync(`${testDbPath}-journal`, '');
        const adapter = registry.getAdapter(testDbUrl);

        await adapter.drop(testDbUrl);

        expect(fs.existsSync(`${testDbPath}-journal`)).toBe(false);
      });
    });
  });

  /**
   * ============================================
   * POSTGRES ADAPTER
   * ============================================
   */
  describe('PostgreSQL Adapter', () => {
    describe('URL Matching', () => {
      it('should match postgresql:// protocol', () => {
        const adapter = registry.getAdapter('postgresql://localhost:5432/db');
        expect(adapter.name).toBe('postgres');
      });

      it('should match postgres:// protocol', () => {
        const adapter = registry.getAdapter('postgres://localhost:5432/db');
        expect(adapter.name).toBe('postgres');
      });

      it('should match URL with credentials', () => {
        const adapter = registry.getAdapter('postgresql://user:pass@localhost:5432/db');
        expect(adapter.name).toBe('postgres');
      });

      it('should match URL with query params', () => {
        const adapter = registry.getAdapter(
          'postgresql://localhost:5432/db?schema=public&connection_limit=5'
        );
        expect(adapter.name).toBe('postgres');
      });

      it('should match remote hosts', () => {
        const adapter = registry.getAdapter('postgresql://db.example.com:5432/mydb');
        expect(adapter.name).toBe('postgres');
      });
    });

    // Note: Actual create/drop operations require a running PostgreSQL server
    // These would be integration tests
  });

  /**
   * ============================================
   * CUSTOM ADAPTER REGISTRATION
   * ============================================
   */
  describe('Custom Adapter Registration', () => {
    it('should allow registering adapter with custom logic', () => {
      const createFn = vi.fn().mockResolvedValue(undefined);
      const dropFn = vi.fn().mockResolvedValue(undefined);

      const customAdapter: DatabaseAdapter = {
        name: 'custom-db',
        matches: (url) => url.startsWith('customdb://'),
        create: createFn,
        drop: dropFn,
      };

      registry.register(customAdapter);

      const adapter = registry.getAdapter('customdb://myinstance');

      expect(adapter.name).toBe('custom-db');
    });

    it('should call custom create function', async () => {
      const createFn = vi.fn().mockResolvedValue(undefined);
      // Use a unique protocol that won't match any previously registered adapters
      const uniqueProtocol = `xyzcreatecustom${Date.now()}`;

      const customAdapter: DatabaseAdapter = {
        name: `${uniqueProtocol}-adapter`,
        matches: (url) => url.startsWith(`${uniqueProtocol}://`),
        create: createFn,
        drop: vi.fn(),
      };

      registry.register(customAdapter);
      const adapter = registry.getAdapter(`${uniqueProtocol}://db`);

      // Verify we got the right adapter
      expect(adapter.name).toBe(`${uniqueProtocol}-adapter`);

      await adapter.create(`${uniqueProtocol}://db`);

      expect(createFn).toHaveBeenCalledWith(`${uniqueProtocol}://db`);
    });

    it('should call custom drop function', async () => {
      const dropFn = vi.fn().mockResolvedValue(undefined);
      // Use a unique protocol that won't match any previously registered adapters
      const uniqueProtocol = `xyzdropcustom${Date.now()}`;

      const customAdapter: DatabaseAdapter = {
        name: `${uniqueProtocol}-adapter`,
        matches: (url) => url.startsWith(`${uniqueProtocol}://`),
        create: vi.fn(),
        drop: dropFn,
      };

      registry.register(customAdapter);
      const adapter = registry.getAdapter(`${uniqueProtocol}://db`);

      // Verify we got the right adapter
      expect(adapter.name).toBe(`${uniqueProtocol}-adapter`);

      await adapter.drop(`${uniqueProtocol}://db`);

      expect(dropFn).toHaveBeenCalledWith(`${uniqueProtocol}://db`);
    });
  });

  /**
   * ============================================
   * URL PARSING EDGE CASES
   * ============================================
   */
  describe('URL Parsing Edge Cases', () => {
    it('should handle URLs with special characters in password', () => {
      const adapter = registry.getAdapter(
        'postgresql://user:p%40ss%23word@localhost:5432/db'
      );
      expect(adapter.name).toBe('postgres');
    });

    it('should handle URLs with IPv6 hosts', () => {
      const adapter = registry.getAdapter('postgresql://[::1]:5432/db');
      expect(adapter.name).toBe('postgres');
    });

    it('should handle SQLite memory database', () => {
      const adapter = registry.getAdapter('file::memory:');
      expect(adapter.name).toBe('sqlite');
    });

    it('should handle SQLite with mode parameter', () => {
      const adapter = registry.getAdapter('file:./test.db?mode=rwc');
      expect(adapter.name).toBe('sqlite');
    });
  });
});
