import * as fs from 'fs';
import * as path from 'path';

// Helper to convert PascalCase to camelCase
function toCamelCase(str: string): string {
  return str.charAt(0).toLowerCase() + str.slice(1);
}

// Helper to find project root
function findProjectRoot(currentDir: string): string {
  if (fs.existsSync(path.join(currentDir, 'package.json'))) {
    return currentDir;
  }
  const parentDir = path.dirname(currentDir);
  if (parentDir === currentDir) {
    throw new Error('Could not find package.json');
  }
  return findProjectRoot(parentDir);
}

export function generateQueries() {
  const rootDir = findProjectRoot(process.cwd());
  const configPath = path.join(rootDir, 'prisma-flare.config.json');
  
  const packageJsonPath = path.join(rootDir, 'package.json');
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
  const isLibraryDev = packageJson.name === 'prisma-flare';

  let config = { 
    queriesPath: 'src/queries',
    dbPath: isLibraryDev ? 'src/core/db' : 'src/db' // Default path to db instance
  };
  
  if (fs.existsSync(configPath)) {
    try {
      const configFile = fs.readFileSync(configPath, 'utf-8');
      config = { ...config, ...JSON.parse(configFile) };
    } catch {
      console.warn('⚠️ Could not read prisma-flare.config.json, using defaults.');
    }
  }

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
    if (isLibraryDev) {
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
