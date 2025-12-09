#!/usr/bin/env node
import { generateQueries } from './generate-queries';
import { spawn } from 'child_process';
import * as path from 'path';

const args = process.argv.slice(2);
const command = args[0];

if (!command) {
  console.log('Usage: prisma-flare <command>');
  console.log('Commands:');
  console.log('  generate    Generate query classes based on schema.prisma');
  console.log('  db:create   Create the database');
  console.log('  db:drop     Drop the database');
  console.log('  db:migrate  Migrate the database');
  console.log('  db:reset    Reset the database');
  console.log('  db:seed     Seed the database');
  process.exit(1);
}

switch (command) {
  case 'generate':
    generateQueries();
    break;
  case 'db:create':
  case 'db:drop':
  case 'db:migrate':
  case 'db:reset':
  case 'db:seed':
    runScript(command);
    break;
  default:
    console.error(`Unknown command: ${command}`);
    process.exit(1);
}

function runScript(scriptName: string) {
  // Map command to file
  const scriptMap: Record<string, string> = {
    'db:create': 'db-create.ts',
    'db:drop': 'db-drop.ts',
    'db:migrate': 'db-migrate.ts',
    'db:reset': 'db-reset.ts',
    'db:seed': 'db-seed.ts',
  };

  const file = scriptMap[scriptName];
  if (!file) {
    console.error(`No script found for ${scriptName}`);
    return;
  }

  // We need to run the script using tsx or node depending on environment.
  // Since this is a library, we might be running from node_modules.
  // The scripts themselves are TS files.
  // If the user is using this library, they likely have tsx or ts-node.
  // But we should probably compile these scripts to JS for the bin?
  // Or assume the user has a TS environment.
  // Given the "plug and play" requirement, we should probably ship JS.
  // But for now, let's assume we are running the TS files using tsx which is a dependency.
  
  // Actually, if we publish this, we publish JS files in dist/.
  // So we should run the JS versions in dist/cli/.
  
  const scriptPath = path.join(__dirname, file.replace('.ts', '.js'));
  
  // If we are in dev (ts-node/tsx), we might need the .ts file
  // But standard practice is to run the compiled .js file.
  
  // Let's try to find the .js file first, if not fall back to .ts?
  // Or just assume we are running from the built distribution.
  
  const child = spawn('node', [scriptPath], { stdio: 'inherit' });
  
  child.on('close', (code) => {
    process.exit(code || 0);
  });
}
