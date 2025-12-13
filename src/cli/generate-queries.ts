import * as fs from 'fs';
import * as path from 'path';
import { loadConfig, findProjectRoot } from './config';

// Helper to convert PascalCase to camelCase
function toCamelCase(str: string): string {
  return str.charAt(0).toLowerCase() + str.slice(1);
}

export function generateQueries() {
  const rootDir = findProjectRoot(process.cwd());
  const config = loadConfig();

  const schemaPath = path.join(rootDir, 'prisma', 'schema.prisma');
  if (!fs.existsSync(schemaPath)) {
    console.error('❌ prisma/schema.prisma not found');
    return;
  }

  const schemaContent = fs.readFileSync(schemaPath, 'utf-8');
  const modelRegex = /model\s+(\w+)\s+{/g;
  const models: string[] = [];
  let match;
  while ((match = modelRegex.exec(schemaContent)) !== null) {
    models.push(match[1]);
  }

  const queriesDir = path.join(rootDir, config.queriesPath);
  if (!fs.existsSync(queriesDir)) {
    fs.mkdirSync(queriesDir, { recursive: true });
  }

  // Calculate relative path to db
  // We need to import 'db' from the user's project into the generated query files.
  // config.dbPath is relative to rootDir (e.g. 'src/db')
  // queriesDir is e.g. 'src/queries'
  
  const absDbPath = path.join(rootDir, config.dbPath);
  let relativePathToDb = path.relative(queriesDir, absDbPath);
  if (!relativePathToDb.startsWith('.')) relativePathToDb = './' + relativePathToDb;
  relativePathToDb = relativePathToDb.replace(/\\/g, '/');

  models.forEach(model => {
    const queryFileName = `${model}Query.ts`;
    const queryFilePath = path.join(queriesDir, queryFileName);
    const modelCamel = toCamelCase(model);

    if (fs.existsSync(queryFilePath)) {
      console.log(`Skipping ${queryFileName} (already exists)...`);
      return;
    }

    console.log(`Generating ${queryFileName}...`);
    
    let queryBuilderImport = "import { QueryBuilder } from 'prisma-flare';";
    
    // Only use relative import if we are developing the library AND the file exists
    const localQueryBuilderPath = path.join(rootDir, 'src/core/queryBuilder.ts');
    if (config.isLibraryDev && fs.existsSync(localQueryBuilderPath)) {
       // In library dev, we import from core
       // queriesDir is src/queries
       // QueryBuilder is in src/core/queryBuilder
       const absQueryBuilderPath = path.join(rootDir, 'src/core/queryBuilder');
       let relativePathToQB = path.relative(queriesDir, absQueryBuilderPath);
       if (!relativePathToQB.startsWith('.')) relativePathToQB = './' + relativePathToQB;
       relativePathToQB = relativePathToQB.replace(/\\/g, '/');
       queryBuilderImport = `import QueryBuilder from '${relativePathToQB}';`;
    }

    const content = `import { db } from '${relativePathToDb}';
${queryBuilderImport}

export default class ${model}Query extends QueryBuilder<'${modelCamel}'> {
  constructor() {
    super(db.${modelCamel});
  }
}
`;
    fs.writeFileSync(queryFilePath, content);
  });

  // Update index.ts
  const indexFilePath = path.join(queriesDir, 'index.ts');
  
  // We regenerate index.ts completely to ensure it's clean
  const imports = models.map(model => `import ${model}Query from './${model}Query';`).join('\n');
  const getters = models.map(model => {
    const modelCamel = toCamelCase(model);
    return `  static get ${modelCamel}() {
    return new ${model}Query();
  }`;
  }).join('\n\n');

  const indexContent = `${imports}

export default class Query {
${getters}
}
`;

  console.log('Updating queries/index.ts...');
  fs.writeFileSync(indexFilePath, indexContent);
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  generateQueries();
}
