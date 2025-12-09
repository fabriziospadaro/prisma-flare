import { DatabaseAdapter } from './index';
import * as fs from 'fs';
import * as path from 'path';

export const SqliteAdapter: DatabaseAdapter = {
  name: 'sqlite',

  matches(url: string): boolean {
    return url.startsWith('file:');
  },

  async create(url: string): Promise<void> {
    const filePath = parseSqliteUrl(url);
    const dir = path.dirname(filePath);

    try {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      if (!fs.existsSync(filePath)) {
        fs.writeFileSync(filePath, '');
        console.log(`✅ SQLite database created at "${filePath}"`);
      } else {
        console.log(`⚠️  SQLite database already exists at "${filePath}"`);
      }
    } catch (error) {
      console.error('❌ Error creating SQLite database:', error);
      throw error;
    }
  },

  async drop(url: string): Promise<void> {
    const filePath = parseSqliteUrl(url);

    try {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        console.log(`✅ SQLite database at "${filePath}" dropped successfully.`);
      } else {
        console.log(`⚠️  SQLite database does not exist at "${filePath}"`);
      }
      
      // Also try to remove the -journal or -wal files if they exist
      if (fs.existsSync(`${filePath}-journal`)) {
        fs.unlinkSync(`${filePath}-journal`);
      }
      if (fs.existsSync(`${filePath}-wal`)) {
        fs.unlinkSync(`${filePath}-wal`);
      }
      if (fs.existsSync(`${filePath}-shm`)) {
        fs.unlinkSync(`${filePath}-shm`);
      }

    } catch (error) {
      console.error('❌ Error dropping SQLite database:', error);
      throw error;
    }
  }
};

function parseSqliteUrl(url: string): string {
  // Remove 'file:' prefix
  let cleanPath = url.replace(/^file:/, '');
  
  // Handle relative paths (relative to cwd)
  if (!path.isAbsolute(cleanPath)) {
    cleanPath = path.resolve(process.cwd(), cleanPath);
  }
  
  return cleanPath;
}
