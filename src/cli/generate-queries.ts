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

  const schemaPath = config.isLibraryDev 
    ? path.join(rootDir, 'tests', 'prisma', 'schema.prisma')
    : path.join(rootDir, 'prisma', 'schema.prisma');

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
       // In library dev, we import from src to simulate package usage
       const absSrcPath = path.join(rootDir, 'src');
       let relativePathToSrc = path.relative(queriesDir, absSrcPath);
       if (!relativePathToSrc.startsWith('.')) relativePathToSrc = './' + relativePathToSrc;
       relativePathToSrc = relativePathToSrc.replace(/\\/g, '/');
       queryBuilderImport = `import { QueryBuilder } from '${relativePathToSrc}';`;
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

  // Update prisma-flare package in node_modules or local dist
  let pfDistDir: string;

  if (config.isLibraryDev) {
    pfDistDir = path.join(rootDir, 'dist');
    if (!fs.existsSync(pfDistDir)) {
      fs.mkdirSync(pfDistDir, { recursive: true });
    }
  } else {
    const pfPackageDir = path.join(rootDir, 'node_modules', 'prisma-flare');
    pfDistDir = path.join(pfPackageDir, 'dist');

    if (!fs.existsSync(pfDistDir)) {
      // If the package is not found, we are likely in the library repo itself or it's not installed.
      // We silently skip without error, as this is expected during library development.
      return;
    }
  }

  // Calculate relative path from dist to db
  // absDbPath is already defined in the outer scope
  
  // Detect extension if missing
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

  // Calculate relative path from dist to models
  const absModelsPath = path.join(queriesDir);
  let relativePathToModels = path.relative(pfDistDir, absModelsPath);
  if (!relativePathToModels.startsWith('.')) relativePathToModels = './' + relativePathToModels;
  relativePathToModels = relativePathToModels.replace(/\\/g, '/');

  const getters = models.map(model => {
    const modelCamel = toCamelCase(model);
    const customPlural = config.plurals?.[model];
    const modelPlural = customPlural || pluralize(modelCamel);
    return `  static get ${modelPlural}() {
    return new ${model}();
  }`;
  }).join('\n\n');

  // Update generated.js (ESM)
  const generatedJsPath = path.join(pfDistDir, 'generated.js');
  console.log(`Writing generated JS to: ${generatedJsPath}`);
  
  const imports = models.map(model => {
    // We generated .ts files, so we import them as .ts for tsx/vitest support
    // In a real ESM build with tsc, this might need to be .js
    return `import ${model} from '${relativePathToModels}/${model}.ts';`;
  }).join('\n');

  const generatedContent = `
import { db } from '${relativePathToDbForDist}';
${imports}

export class DB {
  static get instance() {
    return db;
  }

${getters}
}
`;
  fs.writeFileSync(generatedJsPath, generatedContent);
  console.log('Updated prisma-flare/dist/generated.js');

  // Update generated.cjs (CommonJS)
  const generatedCjsPath = path.join(pfDistDir, 'generated.cjs');
  
  const importsCjs = models.map(model => {
    return `const ${model} = require('${relativePathToModels}/${model}').default;`;
  }).join('\n');

  const generatedCjsContent = `
const { db } = require('${relativePathToDbForDist}');
${importsCjs}

class DB {
  static get instance() {
    return db;
  }

${getters}
}
exports.DB = DB;
`;
  fs.writeFileSync(generatedCjsPath, generatedCjsContent);
  console.log('Updated prisma-flare/dist/generated.cjs');

  // Update generated.d.ts
  const generatedDtsPath = path.join(pfDistDir, 'generated.d.ts');
  
  const importsDts = models.map(model => {
    return `import ${model} from '${relativePathToModels}/${model}';`;
  }).join('\n');

  const gettersTypes = models.map(model => {
    const modelCamel = toCamelCase(model);
    const customPlural = config.plurals?.[model];
    const modelPlural = customPlural || pluralize(modelCamel);
    return `  static get ${modelPlural}(): ${model};`;
  }).join('\n');

  const generatedDtsContent = `
import { db } from '${relativePathToDbForDist}';
${importsDts}

export declare class DB {
  static get instance(): typeof db;

${gettersTypes}
}
`;
  fs.writeFileSync(generatedDtsPath, generatedDtsContent);
  console.log('Updated prisma-flare/dist/generated.d.ts');
}


