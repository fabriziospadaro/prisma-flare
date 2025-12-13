import * as fs from 'fs';
import * as path from 'path';

export interface PrismaFlareConfig {
  modelsPath: string;
  dbPath: string;
  envPath?: string;
  plurals?: Record<string, string>;
}

// Helper to find project root
export function findProjectRoot(currentDir: string): string {
  if (fs.existsSync(path.join(currentDir, 'package.json'))) {
    return currentDir;
  }
  const parentDir = path.dirname(currentDir);
  if (parentDir === currentDir) {
    throw new Error('Could not find package.json');
  }
  return findProjectRoot(parentDir);
}

export function loadConfig(): PrismaFlareConfig {
  const rootDir = findProjectRoot(process.cwd());
  const configPath = path.join(rootDir, 'prisma-flare.config.json');
  
  let config: PrismaFlareConfig = { 
    modelsPath: 'src/models',
    dbPath: 'src/db', // Default path to db instance
  };
  
  if (fs.existsSync(configPath)) {
    try {
      const configFile = fs.readFileSync(configPath, 'utf-8');
      const userConfig = JSON.parse(configFile);
      config = { ...config, ...userConfig };
    } catch {
      console.warn('⚠️ Could not read prisma-flare.config.json, using defaults.');
    }
  }

  return {
    ...config
  };
}
