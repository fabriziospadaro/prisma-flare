import { PostgresAdapter } from './postgres';
import { SqliteAdapter } from './sqlite';

/**
 * Database Adapter Interface
 */
export interface DatabaseAdapter {
  /**
   * Adapter name (e.g., 'postgres', 'sqlite')
   */
  name: string;

  /**
   * Check if this adapter handles the given connection URL
   */
  matches(url: string): boolean;

  /**
   * Create the database
   */
  create(url: string): Promise<void>;

  /**
   * Drop the database
   */
  drop(url: string): Promise<void>;
}

/**
 * Adapter Registry
 */
class AdapterRegistry {
  private adapters: DatabaseAdapter[] = [];

  register(adapter: DatabaseAdapter) {
    this.adapters.push(adapter);
  }

  getAdapter(url: string): DatabaseAdapter {
    const adapter = this.adapters.find((a) => a.matches(url));
    if (!adapter) {
      throw new Error(`No database adapter found for URL: ${url}`);
    }
    return adapter;
  }
}

export const registry = new AdapterRegistry();

// Register default adapters
registry.register(PostgresAdapter);
registry.register(SqliteAdapter);
