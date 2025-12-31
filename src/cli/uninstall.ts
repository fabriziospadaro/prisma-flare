#!/usr/bin/env node
import * as fs from 'fs';
import * as path from 'path';
import { findProjectRoot, loadConfig } from './config';
import { getPrismaClientPath, hasCustomPrismaOutput, getPrismaProvider } from './schema-parser';

/**
 * Cleanup script that runs on npm uninstall.
 * Removes generated files:
 * - node_modules/prisma-flare-generated/
 * - flare.ts from custom Prisma output directory (if present)
 */
export function uninstall() {
  try {
    const rootDir = findProjectRoot(process.cwd());

    // 1. Remove prisma-flare-generated directory
    const prismaFlareGeneratedDir = path.join(rootDir, 'node_modules', 'prisma-flare-generated');
    if (fs.existsSync(prismaFlareGeneratedDir)) {
      fs.rmSync(prismaFlareGeneratedDir, { recursive: true, force: true });
      console.log('✅ Removed node_modules/prisma-flare-generated/');
    }

    // 2. Remove flare.ts from custom Prisma output directory (if using new provider with custom output)
    const config = loadConfig(rootDir);
    const isCustomOutput = hasCustomPrismaOutput(rootDir);
    const provider = getPrismaProvider(rootDir);
    const isNewProvider = provider === 'prisma-client';

    if (isNewProvider && isCustomOutput) {
      let prismaClientPath: string;

      if (config.prismaClientPath) {
        prismaClientPath = path.isAbsolute(config.prismaClientPath)
          ? config.prismaClientPath
          : path.join(rootDir, config.prismaClientPath);
      } else {
        prismaClientPath = getPrismaClientPath(rootDir);
      }

      const flareFilePath = path.join(prismaClientPath, 'flare.ts');
      if (fs.existsSync(flareFilePath)) {
        fs.unlinkSync(flareFilePath);
        console.log(`✅ Removed ${path.relative(rootDir, flareFilePath)}`);
      }
    }

    console.log('\n🧹 prisma-flare cleanup complete');
  } catch (error) {
    // Silently fail if we can't find project root or other errors
    // This is expected when uninstalling from a non-prisma-flare project
    if (process.env.DEBUG) {
      console.error('Uninstall cleanup error:', error);
    }
  }
}

// Run if called directly
uninstall();
