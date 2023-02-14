import { existsSync, writeFileSync } from 'node:fs';
import path from 'path';
import pacote from 'pacote';

export async function extract(
  cacheFolder: string,
  tarball: string,
): Promise<any> {
  // Read .fnpm file to know if it's fully installed
  const fnpmFile = path.join(cacheFolder, downloadFile);
  const fnpmFileExists = existsSync(fnpmFile);

  if (!tarball) {
    throw new Error('No tarball provided');
  }

  if (fnpmFileExists) {
    return {
      res: 'skipped',
    };
  }

  __DOWNLOADING.push(tarball);

  // Extract tarball
  await pacote.extract(tarball, cacheFolder).catch((err: any) => {
    throw new Error(`Error extracting ${tarball} - ${err.message}`);
  });

  // Create .fnpm file
  writeFileSync(fnpmFile, '{}');

  __DOWNLOADING.splice(__DOWNLOADING.indexOf(tarball), 1);

  return {
    res: 'extracted',
  };
}
