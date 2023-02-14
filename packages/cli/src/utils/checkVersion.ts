import chalk from 'chalk';
import { readFile } from 'node:fs/promises';
import ora from 'ora';
import pacote from 'pacote';

export default async function checkVersion() {
  // Get installed version of ULTRA
  const installedVersion = await readFile(
    new URL('../../package.json', import.meta.url),
    'utf8',
  ).then((data) => JSON.parse(data).version);

  // Get latest version of ULTRA
  const { version } = await pacote.manifest('ultra-pkg');

  // If installed version is not the same as latest version, print a warning
  if (installedVersion !== version) {
    ora(
      chalk.yellow(
        `You are using an outdated version of ultra. \n Please update to the latest version by running ${chalk.cyan(
          'ultra upgrade',
        )}\n${chalk.red(installedVersion)} -> ${chalk.green(version)}\n`,
      ),
    ).warn();
  }

  return;
}
