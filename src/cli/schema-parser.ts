import * as fs from 'fs';
import * as path from 'path';

export interface GeneratorClientConfig {
  provider: string;
  output?: string;
}

/**
 * Parses the generator client block from a Prisma schema.
 * Extracts the provider and optional output path.
 *
 * @param schemaContent - The content of the schema.prisma file
 * @returns The generator config or null if not found
 */
export function parseGeneratorClient(schemaContent: string): GeneratorClientConfig | null {
  // Match the generator client block - handles multiline
  const generatorRegex = /generator\s+client\s*\{([^}]+)\}/s;
  const match = schemaContent.match(generatorRegex);

  if (!match) return null;

  const blockContent = match[1];
  const config: GeneratorClientConfig = { provider: 'prisma-client-js' };

  // Parse provider = "..." or provider = '...'
  const providerMatch = blockContent.match(/provider\s*=\s*["']([^"']+)["']/);
  if (providerMatch) {
    config.provider = providerMatch[1];
  }

  // Parse output = "..." or output = '...'
  const outputMatch = blockContent.match(/output\s*=\s*["']([^"']+)["']/);
  if (outputMatch) {
    config.output = outputMatch[1];
  }

  return config;
}

/**
 * Resolves the Prisma client import path based on schema configuration.
 *
 * @param rootDir - The project root directory
 * @param output - The custom output path from generator client (if any)
 * @returns The import path for PrismaClient (either '@prisma/client' or a relative path)
 */
export function resolvePrismaClientPath(rootDir: string, output?: string): string {
  if (!output) {
    // Default: @prisma/client
    return '@prisma/client';
  }

  // Custom output is relative to schema.prisma location (prisma/ directory)
  const schemaDir = path.join(rootDir, 'prisma');
  const absolutePath = path.resolve(schemaDir, output);

  // Return the absolute path - the caller will convert to appropriate relative path
  return absolutePath;
}

/**
 * Gets the Prisma client import path by reading the schema.prisma file.
 *
 * @param rootDir - The project root directory
 * @returns The import path for PrismaClient
 */
export function getPrismaClientPath(rootDir: string): string {
  const schemaPath = path.join(rootDir, 'prisma', 'schema.prisma');

  if (!fs.existsSync(schemaPath)) {
    // No schema found, use default
    return '@prisma/client';
  }

  const schemaContent = fs.readFileSync(schemaPath, 'utf-8');
  const config = parseGeneratorClient(schemaContent);

  return resolvePrismaClientPath(rootDir, config?.output);
}

/**
 * Checks if the project uses a custom Prisma client output path.
 *
 * @param rootDir - The project root directory
 * @returns true if using custom output, false if using default @prisma/client
 */
export function hasCustomPrismaOutput(rootDir: string): boolean {
  const schemaPath = path.join(rootDir, 'prisma', 'schema.prisma');

  if (!fs.existsSync(schemaPath)) {
    return false;
  }

  const schemaContent = fs.readFileSync(schemaPath, 'utf-8');
  const config = parseGeneratorClient(schemaContent);

  return config?.output != null;
}

/**
 * Gets the Prisma generator provider type from the schema.
 *
 * @param rootDir - The project root directory
 * @returns The provider type ('prisma-client-js' or 'prisma-client')
 */
export function getPrismaProvider(rootDir: string): string {
  const schemaPath = path.join(rootDir, 'prisma', 'schema.prisma');

  if (!fs.existsSync(schemaPath)) {
    return 'prisma-client-js';
  }

  const schemaContent = fs.readFileSync(schemaPath, 'utf-8');
  const config = parseGeneratorClient(schemaContent);

  return config?.provider || 'prisma-client-js';
}
