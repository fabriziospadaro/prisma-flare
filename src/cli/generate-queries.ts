import * as fs from 'fs';
import * as path from 'path';
import pluralize from 'pluralize';
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

  const queriesDir = path.join(rootDir, config.modelsPath);
  if (!fs.existsSync(queriesDir)) {
    fs.mkdirSync(queriesDir, { recursive: true });
  }

  // Calculate relative path to db
  // We need to import 'db' from the user's project into the generated query files.
  // config.dbPath is relative to rootDir (e.g. 'src/db')
  // queriesDir is e.g. 'src/models'
  
  const absDbPath = path.join(rootDir, config.dbPath);
  let relativePathToDb = path.relative(queriesDir, absDbPath);
  if (!relativePathToDb.startsWith('.')) relativePathToDb = './' + relativePathToDb;
  relativePathToDb = relativePathToDb.replace(/\\/g, '/');

  models.forEach(model => {
    const queryFileName = `${model}.ts`;
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
       // queriesDir is src/models
       // QueryBuilder is in src/core/queryBuilder
       const absQueryBuilderPath = path.join(rootDir, 'src/core/queryBuilder');
       let relativePathToQB = path.relative(queriesDir, absQueryBuilderPath);
       if (!relativePathToQB.startsWith('.')) relativePathToQB = './' + relativePathToQB;
       relativePathToQB = relativePathToQB.replace(/\\/g, '/');
       queryBuilderImport = `import QueryBuilder from '${relativePathToQB}';`;
    }

    const content = `import { db } from '${relativePathToDb}';
${queryBuilderImport}

export default class ${model} extends QueryBuilder<'${modelCamel}'> {
  constructor() {
    super(db.${modelCamel});
  }
}
`;
    fs.writeFileSync(queryFilePath, content);
  });

  // Update registry file (always in node_modules/.prisma-flare/index.ts)
  const registryPath = 'node_modules/.prisma-flare/index.ts';
  const absRegistryPath = path.join(rootDir, registryPath);
  const registryDir = path.dirname(absRegistryPath);

  if (!fs.existsSync(registryDir)) {
    fs.mkdirSync(registryDir, { recursive: true });
  }

  // Calculate relative path from registry to db
  let relativePathToDbFromRegistry = path.relative(registryDir, absDbPath);
  if (!relativePathToDbFromRegistry.startsWith('.')) relativePathToDbFromRegistry = './' + relativePathToDbFromRegistry;
  relativePathToDbFromRegistry = relativePathToDbFromRegistry.replace(/\\/g, '/');

  // Calculate relative path from registry to models
  const imports = models.map(model => {
    const absModelPath = path.join(queriesDir, model);
    let relativePathToModel = path.relative(registryDir, absModelPath);
    if (!relativePathToModel.startsWith('.')) relativePathToModel = './' + relativePathToModel;
    relativePathToModel = relativePathToModel.replace(/\\/g, '/');
    return `import ${model} from '${relativePathToModel}';`;
  }).join('\n');

  const getters = models.map(model => {
    const modelCamel = toCamelCase(model);
    const customPlural = config.plurals?.[model];
    const modelPlural = customPlural || pluralize(modelCamel);
    return `  static get ${modelPlural}() {
    return new ${model}();
  }`;
  }).join('\n\n');

  const indexContent = `import { db } from '${relativePathToDbFromRegistry}';
${imports}

export default class DB {
  static get instance() {
    return db;
  }

${getters}
}
`;

  console.log(`Updating ${registryPath}...`);
  fs.writeFileSync(absRegistryPath, indexContent);

  // If writing to node_modules, generate a package.json to allow importing as a module
  if (registryPath.includes('node_modules')) {
    const packageJsonPath = path.join(registryDir, 'package.json');
    if (!fs.existsSync(packageJsonPath)) {
      const pkgContent = {
        name: ".prisma-flare",
        types: "index.ts",
        main: "index.ts"
      };
      fs.writeFileSync(packageJsonPath, JSON.stringify(pkgContent, null, 2));
    }
  }
}

