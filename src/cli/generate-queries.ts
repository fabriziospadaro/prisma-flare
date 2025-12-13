import * as fs from 'fs';
import * as path from 'path';
import pluralize from 'pluralize';
import { loadConfig, findProjectRoot } from './config';

function toCamelCase(str: string): string {
  return str.charAt(0).toLowerCase() + str.slice(1);
}

export function generateQueries() {
  const rootDir = findProjectRoot(process.cwd());
  const config = loadConfig();

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

    const localQueryBuilderPath = path.join(rootDir, 'src/core/queryBuilder.ts');
    if (fs.existsSync(localQueryBuilderPath)) {
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

  let pfDistDir: string;

  const pfPackageDir = path.join(rootDir, 'node_modules', 'prisma-flare');
  pfDistDir = path.join(pfPackageDir, 'dist');

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

  const generatedJsPath = path.join(pfDistDir, 'generated.js');
  console.log(`Writing generated JS to: ${generatedJsPath}`);

  const imports = models.map(model => {
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


