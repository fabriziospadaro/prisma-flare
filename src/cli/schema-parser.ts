import * as path from 'path';
import { resolveSchemaPath } from './schema-resolver';

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
 * @param schemaDir - The directory containing the schema (for resolving relative paths)
 * @returns The import path for PrismaClient (either '@prisma/client' or a relative path)
 */
export function resolvePrismaClientPath(rootDir: string, output?: string, schemaDir?: string): string {
  if (!output) {
    // Default: @prisma/client
    return '@prisma/client';
  }

  // Custom output is relative to schema location
  // For single-file: relative to the directory containing schema.prisma
  // For multi-file: relative to the schema directory
  const resolvedSchemaDir = schemaDir || path.join(rootDir, 'prisma');
  const absolutePath = path.resolve(resolvedSchemaDir, output);

  // Return the absolute path - the caller will convert to appropriate relative path
  return absolutePath;
}

/**
 * Gets the Prisma client import path by reading the Prisma schema.
 * Supports both single-file and multi-file (directory) schemas.
 *
 * @param rootDir - The project root directory
 * @returns The import path for PrismaClient
 */
export function getPrismaClientPath(rootDir: string): string {
  const resolution = resolveSchemaPath(rootDir);

  if (!resolution) {
    // No schema found, use default
    return '@prisma/client';
  }

  const config = parseGeneratorClient(resolution.generatorContent);

  return resolvePrismaClientPath(rootDir, config?.output, resolution.schemaDir);
}

/**
 * Checks if the project uses a custom Prisma client output path.
 * Supports both single-file and multi-file (directory) schemas.
 *
 * @param rootDir - The project root directory
 * @returns true if using custom output, false if using default @prisma/client
 */
export function hasCustomPrismaOutput(rootDir: string): boolean {
  const resolution = resolveSchemaPath(rootDir);

  if (!resolution) {
    return false;
  }

  const config = parseGeneratorClient(resolution.generatorContent);

  return config?.output != null;
}

/**
 * Gets the Prisma generator provider type from the schema.
 * Supports both single-file and multi-file (directory) schemas.
 *
 * @param rootDir - The project root directory
 * @returns The provider type ('prisma-client-js' or 'prisma-client')
 */
export function getPrismaProvider(rootDir: string): string {
  const resolution = resolveSchemaPath(rootDir);

  if (!resolution) {
    return 'prisma-client-js';
  }

  const config = parseGeneratorClient(resolution.generatorContent);

  return config?.provider || 'prisma-client-js';
}

/**
 * Represents a relation from one model to another.
 */
export interface ModelRelation {
  /** The name of the relation field */
  fieldName: string;
  /** The target model name (PascalCase) */
  targetModel: string;
  /** Whether this is an array relation (has-many) */
  isArray: boolean;
}

/**
 * Parsed model information from the schema.
 */
export interface ParsedModel {
  /** The model name (PascalCase) */
  name: string;
  /** Relations to other models */
  relations: ModelRelation[];
}

/**
 * Parses all models and their relations from a Prisma schema.
 *
 * @param schemaContent - The content of the schema.prisma file
 * @returns Array of parsed models with their relations
 */
export function parseModelRelations(schemaContent: string): ParsedModel[] {
  const models: ParsedModel[] = [];

  const modelStartRegex = /model\s+(\w+)\s*\{/g;
  let modelMatch;

  while ((modelMatch = modelStartRegex.exec(schemaContent)) !== null) {
    const modelName = modelMatch[1];
    const bodyStart = modelMatch.index + modelMatch[0].length;
    let depth = 1;
    let i = bodyStart;
    let inString = false;
    let stringChar = '';
    while (i < schemaContent.length && depth > 0) {
      const ch = schemaContent[i];
      if (inString) {
        if (ch === stringChar && schemaContent[i - 1] !== '\\') inString = false;
      } else {
        if (ch === '"' || ch === "'") {
          inString = true;
          stringChar = ch;
        } else if (ch === '{') {
          depth++;
        } else if (ch === '}') {
          depth--;
        }
      }
      i++;
    }
    const modelBody = schemaContent.slice(bodyStart, i - 1);
    const relations: ModelRelation[] = [];

    // Parse each line in the model body
    const lines = modelBody.split('\n');
    for (const line of lines) {
      const trimmed = line.trim();

      // Skip empty lines, comments, and index/unique declarations
      if (!trimmed || trimmed.startsWith('//') || trimmed.startsWith('@@')) {
        continue;
      }

      // Match relation fields:
      // fieldName Type[] - array relation
      // fieldName Type @relation(...) - single relation
      // fieldName Type? @relation(...) - optional single relation
      const relationMatch = trimmed.match(/^(\w+)\s+(\w+)(\[\])?\??(?:\s+@relation)?/);

      if (relationMatch) {
        const fieldName = relationMatch[1];
        const fieldType = relationMatch[2];
        const isArray = relationMatch[3] === '[]';

        // Check if this is a relation field (type starts with uppercase and is not a scalar type)
        const scalarTypes = [
          'String',
          'Int',
          'Float',
          'Boolean',
          'DateTime',
          'Json',
          'Bytes',
          'BigInt',
          'Decimal',
        ];

        if (
          fieldType[0] === fieldType[0].toUpperCase() &&
          !scalarTypes.includes(fieldType) &&
          !fieldName.startsWith('@@')
        ) {
          relations.push({
            fieldName,
            targetModel: fieldType,
            isArray,
          });
        }
      }
    }

    models.push({ name: modelName, relations });
  }

  return models;
}

/**
 * Generates a RelationModelMap type string from parsed models.
 * This maps each model's relation field names to their target model names (lowercase).
 *
 * @param models - Array of parsed models from parseModelRelations
 * @returns TypeScript type definition string
 */
export function generateRelationModelMap(models: ParsedModel[]): string {
  const entries = models.map((model) => {
    const modelKey = model.name.charAt(0).toLowerCase() + model.name.slice(1);
    const relationEntries = model.relations.map((rel) => {
      const targetKey = rel.targetModel.charAt(0).toLowerCase() + rel.targetModel.slice(1);
      return `    ${rel.fieldName}: '${targetKey}'`;
    });

    if (relationEntries.length === 0) {
      return `  ${modelKey}: Record<string, never>`;
    }

    return `  ${modelKey}: {\n${relationEntries.join(',\n')}\n  }`;
  });

  return `/**
 * Static mapping of model relations to their target model names.
 * Generated from the Prisma schema during prisma-flare generate.
 */
type RelationModelMap = {
${entries.join(',\n')}
};`;
}

/**
 * Gets the RelationModelMap type for a project.
 * Uses Prisma's DMMF (Data Model Meta Format) for reliable model introspection.
 * Falls back to schema parsing if DMMF is not available.
 *
 * @param rootDir - The project root directory
 * @returns The RelationModelMap type definition string, or null if schema not found
 */
export function getRelationModelMap(rootDir: string): string | null {
  const dmmfResult = getRelationModelMapFromDMMF(rootDir);
  if (dmmfResult) return dmmfResult;

  const resolution = resolveSchemaPath(rootDir);
  if (!resolution) return null;

  const models = parseModelRelations(resolution.content);
  return generateRelationModelMap(models);
}

/**
 * Extracts the RelationModelMap from Prisma's DMMF (generated client metadata).
 * This is the most reliable approach as it uses Prisma's own parser output.
 */
function getRelationModelMapFromDMMF(rootDir: string): string | null {
  try {
    const clientPath = getPrismaClientPath(rootDir);
    const resolvedPath = clientPath.startsWith('/')
      ? clientPath
      : require.resolve(clientPath, { paths: [rootDir] });

    const prismaModule = require(resolvedPath);
    const dmmf = prismaModule?.Prisma?.dmmf ?? prismaModule?.dmmf;
    if (!dmmf?.datamodel?.models) return null;

    const models: ParsedModel[] = dmmf.datamodel.models.map((model: { name: string; fields: Array<{ name: string; kind: string; type: string; isList: boolean }> }) => ({
      name: model.name,
      relations: model.fields
        .filter((f: { kind: string }) => f.kind === 'object')
        .map((f: { name: string; type: string; isList: boolean }) => ({
          fieldName: f.name,
          targetModel: f.type,
          isArray: f.isList,
        })),
    }));

    return generateRelationModelMap(models);
  } catch {
    return null;
  }
}
