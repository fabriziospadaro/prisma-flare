import * as fs from 'fs';
import * as path from 'path';

export interface PrismaFlareConfig {
  modelsPath: string;
  dbPath: string;
  envPath?: string;
  plurals?: Record<string, string>;
  readonly isLibraryDev: boolean;
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
  
  const packageJsonPath = path.join(rootDir, 'package.json');
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
  const isLibraryDev = packageJson.name === 'prisma-flare';

  let config: Omit<PrismaFlareConfig, 'isLibraryDev'> = { 
    modelsPath: isLibraryDev ? 'tests/generated/models' : 'src/models',
    dbPath: isLibraryDev ? 'tests/db' : 'src/db', // Default path to db instance
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
    ...config,
    isLibraryDev
  };
}
