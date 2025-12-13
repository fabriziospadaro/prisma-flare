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

  // Update prisma-flare package in node_modules
  if (config.isLibraryDev) {
    console.log('Skipping package update in library dev mode');
    return;
  }

  const pfPackageDir = path.join(rootDir, 'node_modules', 'prisma-flare');
  const pfDistDir = path.join(pfPackageDir, 'dist');

  if (!fs.existsSync(pfDistDir)) {
    console.warn('⚠️ Could not find prisma-flare dist directory. Skipping DB export generation.');
    return;
  }

  // Calculate relative path from dist to db
  // absDbPath is already defined in the outer scope
  let relativePathToDbForDist = path.relative(pfDistDir, absDbPath);
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

  const injectionMarker = '// --- PRISMA-FLARE-GENERATED ---';

  // Update index.js (ESM)
  const indexJsPath = path.join(pfDistDir, 'index.js');
  if (fs.existsSync(indexJsPath)) {
    let content = fs.readFileSync(indexJsPath, 'utf-8');
    if (content.includes(injectionMarker)) {
      content = content.split(injectionMarker)[0];
    }

    const imports = models.map(model => {
      return `import ${model} from '${relativePathToModels}/${model}';`;
    }).join('\n');

    const newContent = `${content}
${injectionMarker}
import { db } from '${relativePathToDbForDist}';
${imports}

export class DB {
  static get instance() {
    return db;
  }

${getters}
}
`;
    fs.writeFileSync(indexJsPath, newContent);
    console.log('Updated prisma-flare/dist/index.js');
  }

  // Update index.cjs (CommonJS)
  const indexCjsPath = path.join(pfDistDir, 'index.cjs');
  if (fs.existsSync(indexCjsPath)) {
    let content = fs.readFileSync(indexCjsPath, 'utf-8');
    if (content.includes(injectionMarker)) {
      content = content.split(injectionMarker)[0];
    }

    const imports = models.map(model => {
      return `const ${model} = require('${relativePathToModels}/${model}').default;`;
    }).join('\n');

    const newContent = `${content}
${injectionMarker}
const { db } = require('${relativePathToDbForDist}');
${imports}

class DB {
  static get instance() {
    return db;
  }

${getters}
}
exports.DB = DB;
`;
    fs.writeFileSync(indexCjsPath, newContent);
    console.log('Updated prisma-flare/dist/index.cjs');
  }

  // Update index.d.ts
  const indexDtsPath = path.join(pfDistDir, 'index.d.ts');
  if (fs.existsSync(indexDtsPath)) {
    let content = fs.readFileSync(indexDtsPath, 'utf-8');
    if (content.includes(injectionMarker)) {
      content = content.split(injectionMarker)[0];
    }

    const imports = models.map(model => {
      return `import ${model} from '${relativePathToModels}/${model}';`;
    }).join('\n');

    const gettersTypes = models.map(model => {
      const modelCamel = toCamelCase(model);
      const customPlural = config.plurals?.[model];
      const modelPlural = customPlural || pluralize(modelCamel);
      return `  static get ${modelPlural}(): ${model};`;
    }).join('\n');

    const newContent = `${content}
${injectionMarker}
import { db } from '${relativePathToDbForDist}';
${imports}

export declare class DB {
  static get instance(): typeof db;

${gettersTypes}
}
`;
    fs.writeFileSync(indexDtsPath, newContent);
    console.log('Updated prisma-flare/dist/index.d.ts');
  }
}


