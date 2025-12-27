import * as fs from 'fs';
import * as path from 'path';
import pluralize from 'pluralize';
import { loadConfig, findProjectRoot } from './config';
import { hasCustomPrismaOutput, getPrismaProvider } from './schema-parser';

function toCamelCase(str: string): string {
  return str.charAt(0).toLowerCase() + str.slice(1);
}

interface RelationInfo {
  fieldName: string;
  targetModel: string;
}

function parseRelations(schemaContent: string, models: string[]): Map<string, RelationInfo[]> {
  const relations = new Map<string, RelationInfo[]>();

  // Initialize empty arrays for each model
  models.forEach(model => relations.set(model, []));

  // Parse each model block
  const modelBlockRegex = /model\s+(\w+)\s+{([^}]+)}/g;
  let modelMatch;

  while ((modelMatch = modelBlockRegex.exec(schemaContent)) !== null) {
    const modelName = modelMatch[1];
    const modelBody = modelMatch[2];

    // Find relation fields (fields that reference other models)
    const lines = modelBody.split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('//') || trimmed.startsWith('@')) continue;

      // Match field definitions like: posts Post[] or author User
      const fieldMatch = trimmed.match(/^(\w+)\s+(\w+)(\[\])?\s*/);
      if (fieldMatch) {
        const fieldName = fieldMatch[1];
        const fieldType = fieldMatch[2];
        const _isArray = !!fieldMatch[3];

        // Check if fieldType is one of our models (it's a relation)
        if (models.includes(fieldType)) {
          const modelRelations = relations.get(modelName) || [];
          modelRelations.push({ fieldName, targetModel: fieldType });
          relations.set(modelName, modelRelations);
        }
      }
    }
  }

  return relations;
}

export function generateQueries() {
  const rootDir = findProjectRoot(process.cwd());
  const config = loadConfig(rootDir);

  const schemaPath = path.join(rootDir, 'prisma', 'schema.prisma');

  if (!fs.existsSync(schemaPath)) {
    console.error(`❌ Schema not found at ${schemaPath}`);
    return;
  }

  const schemaContent = fs.readFileSync(schemaPath, 'utf-8');
  const modelRegex = /model\s+(\w+)\s+{/g;
  const models: string[] = [];
  let match;
  while ((match = modelRegex.exec(schemaContent)) !== null) {
    models.push(match[1]);
  }

  const queriesDir = path.join(rootDir, config.modelsPath);
  if (!fs.existsSync(queriesDir)) {
    fs.mkdirSync(queriesDir, { recursive: true });
  }

  const absDbPath = path.join(rootDir, config.dbPath);
  let relativePathToDb = path.relative(queriesDir, absDbPath);
  if (!relativePathToDb.startsWith('.')) relativePathToDb = './' + relativePathToDb;
  relativePathToDb = relativePathToDb.replace(/\\/g, '/');

  // Check if this project uses custom Prisma output and which provider
  const isCustomOutput = hasCustomPrismaOutput(rootDir);
  const provider = getPrismaProvider(rootDir);
  const isNewProvider = provider === 'prisma-client';

  models.forEach(model => {
    const queryFileName = `${model}.ts`;
    const queryFilePath = path.join(queriesDir, queryFileName);
    const modelCamel = toCamelCase(model);

    if (fs.existsSync(queryFilePath)) {
      return;
    }

    console.log(`Generating ${queryFileName}...`);

    // For custom output (any provider): use .prisma-flare for proper local types
    // For default output: use prisma-flare directly
    let queryBuilderImport = isCustomOutput
      ? "import { FlareBuilder } from '.prisma-flare';"
      : "import { FlareBuilder } from 'prisma-flare';";

    // Check if we're in the prisma-flare package itself (development)
    const localQueryBuilderPath = path.join(rootDir, 'src/core/flareBuilder.ts');
    if (fs.existsSync(localQueryBuilderPath)) {
      const absSrcPath = path.join(rootDir, 'src');
      let relativePathToSrc = path.relative(queriesDir, absSrcPath);
      if (!relativePathToSrc.startsWith('.')) relativePathToSrc = './' + relativePathToSrc;
      relativePathToSrc = relativePathToSrc.replace(/\\/g, '/');
      queryBuilderImport = `import { FlareBuilder } from '${relativePathToSrc}';`;
    }

    const content = `import { db } from '${relativePathToDb}';
${queryBuilderImport}

export default class ${model} extends FlareBuilder<'${modelCamel}'> {
  constructor() {
    super(db.${modelCamel});
  }
}
`;
    fs.writeFileSync(queryFilePath, content);
  });

  let pfDistDir: string;

  const pfPackageDir = path.join(rootDir, 'node_modules', 'prisma-flare');
  let realPfPackageDir = pfPackageDir;
  if (fs.existsSync(pfPackageDir)) {
    realPfPackageDir = fs.realpathSync(pfPackageDir);
  }
  pfDistDir = path.join(realPfPackageDir, 'dist');

  let dbPathWithExt = absDbPath;
  if (!absDbPath.endsWith('.ts') && !absDbPath.endsWith('.js')) {
    if (fs.existsSync(absDbPath + '.ts')) {
      dbPathWithExt = absDbPath + '.ts';
    } else if (fs.existsSync(absDbPath + '.js')) {
      dbPathWithExt = absDbPath + '.js';
    }
  }

  let relativePathToDbForDist = path.relative(pfDistDir, dbPathWithExt);
  if (!relativePathToDbForDist.startsWith('.')) relativePathToDbForDist = './' + relativePathToDbForDist;
  relativePathToDbForDist = relativePathToDbForDist.replace(/\\/g, '/');

  const relativePathToDbForDts = relativePathToDbForDist;

  const absModelsPath = path.join(queriesDir);
  let relativePathToModels = path.relative(pfDistDir, absModelsPath);
  if (!relativePathToModels.startsWith('.')) relativePathToModels = './' + relativePathToModels;
  relativePathToModels = relativePathToModels.replace(/\\/g, '/');

  // Parse relations from schema
  const relations = parseRelations(schemaContent, models);

  const getters = models.map(model => {
    const modelCamel = toCamelCase(model);
    const customPlural = config.plurals?.[model];
    const modelPlural = customPlural || pluralize(modelCamel);
    return `  static get ${modelPlural}() {
    return new ${model}();
  }`;
  }).join('\n\n');

  // Generate model registry entries - register model names, plurals, and relation field names
  const registrationLines: string[] = [];
  models.forEach(model => {
    const modelCamel = toCamelCase(model);
    const customPlural = config.plurals?.[model];
    const modelPlural = customPlural || pluralize(modelCamel);
    // Register by singular camelCase name (e.g., 'user', 'course', 'enrollment')
    registrationLines.push(`modelRegistry.register('${modelCamel}', ${model});`);
    // Register by plural name
    registrationLines.push(`modelRegistry.register('${modelPlural}', ${model});`);
  });

  // Also register by relation field names (e.g., 'author' -> User, 'posts' -> Post)
  relations.forEach((rels, _modelName) => {
    rels.forEach(rel => {
      registrationLines.push(`modelRegistry.register('${rel.fieldName}', ${rel.targetModel});`);
    });
  });

  const modelRegistrations = registrationLines.join('\n');

  const generatedJsPath = path.join(pfDistDir, 'generated.js');

  const imports = models.map(model => {
    return `import ${model} from '${relativePathToModels}/${model}.ts';`;
  }).join('\n');

  const generatedContent = `
import { db } from '${relativePathToDbForDist}';
import { modelRegistry } from './index.js';
${imports}

// Register all models so include() can use custom model classes
${modelRegistrations}

export class DB {
  static get instance() {
    return db;
  }

${getters}
}
`;
  fs.writeFileSync(generatedJsPath, generatedContent);
  // Update generated.cjs (CommonJS)
  const generatedCjsPath = path.join(pfDistDir, 'generated.cjs');

  const importsCjs = models.map(model => {
    return `const ${model} = require('${relativePathToModels}/${model}').default;`;
  }).join('\n');

  const generatedCjsContent = `
const { db } = require('${relativePathToDbForDist}');
const { modelRegistry } = require('./index.cjs');
${importsCjs}

// Register all models so include() can use custom model classes
${modelRegistrations}

class DB {
  static get instance() {
    return db;
  }

${getters}
}
exports.DB = DB;
`;
  fs.writeFileSync(generatedCjsPath, generatedCjsContent);

  // Update generated.d.ts
  const generatedDtsPath = path.join(pfDistDir, 'generated.d.ts');

  const importsDts = models.map(model => {
    return `import ${model} from '${relativePathToModels}/${model}.ts';`;
  }).join('\n');

  const gettersTypes = models.map(model => {
    const modelCamel = toCamelCase(model);
    const customPlural = config.plurals?.[model];
    const modelPlural = customPlural || pluralize(modelCamel);
    return `  static get ${modelPlural}(): ${model};`;
  }).join('\n');

  // Generate RelationModelMap - maps relation field names to their model classes
  const relationMapEntries: string[] = [];

  // Add model name mappings (singular and plural)
  models.forEach(model => {
    const modelCamel = toCamelCase(model);
    const customPlural = config.plurals?.[model];
    const modelPlural = customPlural || pluralize(modelCamel);
    relationMapEntries.push(`    ${modelCamel}: ${model};`);
    relationMapEntries.push(`    ${modelPlural}: ${model};`);
  });

  // Add relation field name mappings
  relations.forEach((rels, _modelName) => {
    rels.forEach(rel => {
      // Only add if not already present (avoid duplicates)
      const entry = `    ${rel.fieldName}: ${rel.targetModel};`;
      if (!relationMapEntries.includes(entry)) {
        relationMapEntries.push(entry);
      }
    });
  });

  const generatedDtsContent = `
import { db } from '${relativePathToDbForDts}';
${importsDts}

/**
 * Module augmentation to provide type-safe includes.
 * This maps relation field names to their custom model classes.
 */
declare module 'prisma-flare' {
  interface RelationModelMap {
${relationMapEntries.join('\n')}
  }
}

export declare class DB {
  static get instance(): typeof db;

${gettersTypes}
}
`;
  fs.writeFileSync(generatedDtsPath, generatedDtsContent);
}


