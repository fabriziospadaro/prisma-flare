import * as fs from 'fs';
import * as path from 'path';

export interface PrismaFlareConfig {
  modelsPath: string;
  dbPath: string;
  callbacksPath: string;
  plurals?: Record<string, string>;
  /**
   * Override the auto-detected Prisma client import path.
   * Use this if auto-detection from schema.prisma doesn't work for your setup.
   *
   * @example
   * // For custom Prisma output
   * { "prismaClientPath": "./generated/client" }
   *
   * // For monorepo setups
   * { "prismaClientPath": "@myorg/database" }
   */
  prismaClientPath?: string;
}

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

export function loadConfig(rootDir?: string): PrismaFlareConfig {
  const projectRoot = rootDir || findProjectRoot(process.cwd());
  const configPath = path.join(projectRoot, 'prisma-flare.config.json');

  let config: PrismaFlareConfig = {
    modelsPath: 'prisma/models',
    dbPath: 'prisma/db',
    callbacksPath: 'prisma/callbacks',
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
