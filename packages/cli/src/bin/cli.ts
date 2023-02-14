#!/usr/bin/env node
import chalk from 'chalk';
import path from 'node:path';
import { __dirname } from '../utils/__dirname.js';
import '../utils/globals.js';
import { readPackage } from '@ultrapkg/read-package';

async function main() {
  const { version } = readPackage(
    path.join(__dirname, '..', '..', 'package.json'),
  );

  console.log(
    chalk.grey(
      `[Ultra] v${version} (${(process.uptime() * 1000).toFixed(2)}ms)`,
    ),
  );

  const { args } = await import('../utils/arguments.js');

  const argv = args();

  const { commands } = await import('../commands/index.js');

  commands(argv);
}

main();
