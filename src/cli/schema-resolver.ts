import * as fs from 'fs';
import * as path from 'path';

export interface SchemaResolution {
  /** The resolved schema path (file or directory) */
  schemaPath: string;
  /** Whether the schema is a directory (multi-file) */
  isDirectory: boolean;
  /** The merged schema content from all files (for model parsing) */
  content: string;
  /** The content of the file containing the generator block (for generator config parsing) */
  generatorContent: string;
  /** The directory containing the schema (for resolving relative paths) */
  schemaDir: string;
}

/**
 * Reads and parses prisma.config.ts to get the schema path.
 * Prisma 7+ uses this config file to define the schema location.
 *
 * @param rootDir - The project root directory
 * @returns The schema path from config, or null if not found
 */
function readPrismaConfigSchema(rootDir: string): string | null {
  const configPaths = [
    path.join(rootDir, 'prisma.config.ts'),
    path.join(rootDir, 'prisma.config.js'),
    path.join(rootDir, 'prisma.config.mjs'),
    path.join(rootDir, 'prisma.config.cjs'),
  ];

  for (const configPath of configPaths) {
    if (!fs.existsSync(configPath)) {
      continue;
    }

    try {
      const content = fs.readFileSync(configPath, 'utf-8');

      // Parse schema path from the config file using regex
      // Handles both: schema: "path" and schema: 'path'
      const schemaMatch = content.match(/schema\s*:\s*["']([^"']+)["']/);
      if (schemaMatch) {
        return schemaMatch[1];
      }

      // Also check for schema: path without quotes (variable or direct path)
      // This handles: schema: "./prisma/schema"
      const schemaMatchUnquoted = content.match(/schema\s*:\s*([^\s,}]+)/);
      if (schemaMatchUnquoted && !schemaMatchUnquoted[1].startsWith('//')) {
        const value = schemaMatchUnquoted[1].trim();
        // Remove quotes if present
        return value.replace(/^["']|["']$/g, '');
      }
    } catch {
      // Ignore parse errors, fall back to default
    }
  }

  return null;
}

/**
 * Reads all .prisma files from a directory and merges their content.
 *
 * @param dirPath - The directory containing .prisma files
 * @returns The merged content of all .prisma files
 */
function mergeSchemaDirectory(dirPath: string): string {
  const files = getPrismaFiles(dirPath);

  const contents: string[] = [];
  for (const file of files) {
    const filePath = path.join(dirPath, file);
    const content = fs.readFileSync(filePath, 'utf-8');
    contents.push(content);
  }

  return contents.join('\n\n');
}

/**
 * Gets all .prisma files in a directory.
 */
function getPrismaFiles(dirPath: string): string[] {
  if (!fs.existsSync(dirPath) || !fs.statSync(dirPath).isDirectory()) {
    throw new Error(`Schema directory not found: ${dirPath}`);
  }

  const files = fs.readdirSync(dirPath).filter(file => file.endsWith('.prisma'));

  if (files.length === 0) {
    throw new Error(`No .prisma files found in directory: ${dirPath}`);
  }

  return files;
}

/**
 * Finds and reads the file containing the generator block in a schema directory.
 * Searches through all .prisma files until it finds one with a generator block.
 *
 * @param dirPath - The directory containing .prisma files
 * @returns The content of the file with the generator block, or null if not found
 */
function findGeneratorFile(dirPath: string): string | null {
  const files = getPrismaFiles(dirPath);

  for (const file of files) {
    const filePath = path.join(dirPath, file);
    const content = fs.readFileSync(filePath, 'utf-8');

    // Check if this file has a generator block
    if (/generator\s+\w+\s*\{/.test(content)) {
      return content;
    }
  }

  return null;
}

/**
 * Resolves the Prisma schema path using multiple strategies:
 * 1. prisma.config.ts schema (Prisma 7+ - handles monorepos/custom locations)
 * 2. prisma/schema/ directory (multi-file default)
 * 3. prisma/schema.prisma file (single-file default)
 *
 * Supports both single-file and multi-file (directory) schemas.
 *
 * @param rootDir - The project root directory
 * @returns Schema resolution with path, content, and metadata
 */
export function resolveSchemaPath(rootDir: string): SchemaResolution | null {
  let schemaPath: string | null = null;

  // Priority 1: prisma.config.ts (Prisma 7+)
  const prismaConfigSchema = readPrismaConfigSchema(rootDir);
  if (prismaConfigSchema) {
    schemaPath = path.isAbsolute(prismaConfigSchema)
      ? prismaConfigSchema
      : path.join(rootDir, prismaConfigSchema);
  }

  // Priority 2: prisma/schema/ directory (multi-file)
  if (!schemaPath) {
    const schemaDir = path.join(rootDir, 'prisma', 'schema');
    if (fs.existsSync(schemaDir) && fs.statSync(schemaDir).isDirectory()) {
      schemaPath = schemaDir;
    }
  }

  // Priority 3: prisma/schema.prisma file (single-file)
  if (!schemaPath) {
    const singleFile = path.join(rootDir, 'prisma', 'schema.prisma');
    if (fs.existsSync(singleFile)) {
      schemaPath = singleFile;
    }
  }

  if (!schemaPath) {
    return null;
  }

  // Check if path exists
  if (!fs.existsSync(schemaPath)) {
    return null;
  }

  const stat = fs.statSync(schemaPath);

  if (stat.isDirectory()) {
    // Multi-file schema directory
    try {
      const content = mergeSchemaDirectory(schemaPath);
      const generatorContent = findGeneratorFile(schemaPath) || content;
      return {
        schemaPath,
        isDirectory: true,
        content,
        generatorContent,
        schemaDir: schemaPath,
      };
    } catch {
      return null;
    }
  } else if (stat.isFile()) {
    // Single-file schema
    const content = fs.readFileSync(schemaPath, 'utf-8');
    return {
      schemaPath,
      isDirectory: false,
      content,
      generatorContent: content,
      schemaDir: path.dirname(schemaPath),
    };
  }

  return null;
}
