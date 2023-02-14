import { logger } from '@ultrapkg/logger';
import { readPackage } from '@ultrapkg/read-package';
import { DependencyType, getDeps } from '@ultrapkg/get-deps';
import { manifestFetcher } from '@ultrapkg/manifest-fetcher';
import { satisfies } from 'semver';
import { getPackageDir, PackageDirectoryMap } from './get-dep-directory';
import { join } from 'path';
import { existsSync, readFileSync } from 'fs';
import { eventHandler, EventType } from '@ultrapkg/event-handler';

const directories: PackageDirectoryMap = {};

export const depCache = new Map<string, Dep>();

export async function resolver(packageDir: string) {
  const pkgJson = readPackage(packageDir);
  const deps = getDeps(pkgJson);

  await Promise.all(
    deps.map(
      async (dep) =>
        await resolveDep({
          ...dep,
          parent: ['node_modules'],
        }),
    ),
  );

  return depCache;
}

async function resolveDep(dep: {
  name: string;
  version: string;
  parent?: string[];
  optional?: boolean | undefined;
  type: DependencyType;
}): Promise<any> {
  logger.update('resolver', {
    text: `Resolving ${dep.name}@${dep.version}`,
  });
  const { name, version, parent, optional } = dep;

  if (depSatisfies(name, version)) {
    return;
  }

  // Check if installed versions locally satisfy the dependency
  const cacheIndex = join(userUltraCache, name, 'index.json');
  if (existsSync(cacheIndex)) {
    const cache = JSON.parse(readFileSync(cacheIndex, 'utf-8'));
    const versions = Object.keys(cache);
    const satisfiesVersion = versions.find((v) => satisfies(v, version));
    if (satisfiesVersion) {
      const map = depCache.get(name) || {};

      const manifest = readPackage(
        join(userUltraCache, name, satisfiesVersion, 'package.json'),
      );

      const selectedDir = getPackageDir(
        name,
        manifest.version,
        parent,
        directories,
      );

      if (!selectedDir) return;

      eventHandler.addResolvedDep({
        name,
        version: manifest.version,
        sha: cache[satisfiesVersion].sha,
        tarball: cache[satisfiesVersion].tarball,
        cachePath: join(userUltraCache, name, manifest.version),
        path: selectedDir,
        type: dep.type,
      });

      map[satisfiesVersion] = {
        spec: version,
        parent,
        optional: optional || false,
        path: selectedDir,
        type: dep.type,
        sha: cache[satisfiesVersion].sha,
        tarball: cache[satisfiesVersion].tarball,
      };
      depCache.set(name, map);

      const dependencies = getDeps(manifest, {
        dev: true,
      });

      return Promise.all(
        dependencies.map((dep) => {
          const status = depSatisfies(dep.name, dep.version);
          if (status === 'satisfies') {
            return;
          } else if (status) {
            // add dependency to cache and return
            const depMap = depCache.get(dep.name) || {};
            depMap[`file:${status}`] = {
              spec: dep.version,
              parent: [selectedDir],
              optional: dep.optional || false,
              path: `file:${status}`,
              type: dep.type,
            };
            depCache.set(dep.name, depMap);
            return;
          }

          return resolveDep({ ...dep, parent: [selectedDir] });
        }),
      );
    }
  }

  const manifest = await manifestFetcher(`${name}@${version}`);

  const depMap = depCache.get(name) || {};

  const selectedDir = getPackageDir(
    name,
    manifest.version,
    parent,
    directories,
  );

  if (!selectedDir) {
    return;
  }

  depMap[manifest.version] = {
    spec: version,
    parent,
    optional: optional || false,
    path: selectedDir,
    type: dep.type,
    tarball: manifest.dist.tarball,
    sha: manifest.dist.integrity,
  };

  depCache.set(name, depMap);

  eventHandler.addResolvedDep({
    name,
    version: manifest.version,
    sha: manifest.dist.integrity,
    tarball: manifest.dist.tarball,
    cachePath: join(userUltraCache, name, manifest.version),
    path: selectedDir,
    type: dep.type,
  });

  const deps = getDeps(manifest, {
    dev: true,
  });

  return Promise.all(
    deps.map((dep) => {
      const status = depSatisfies(dep.name, dep.version);
      if (status === 'satisfies') {
        return;
      } else if (status) {
        // add dependency to cache and return
        const depMap = depCache.get(dep.name) || {};
        depMap[`file:${status}`] = {
          spec: dep.version,
          parent: [selectedDir],
          optional: dep.optional || false,
          path: `file:${status}`,
          type: dep.type,
        };
        depCache.set(dep.name, depMap);
        return;
      }
      return resolveDep({ ...dep, parent: [selectedDir] });
    }),
  );
}

function depSatisfies(
  name: string,
  version: string,
): null | 'satisfies' | string {
  const baseDir = join('node_modules', name);

  // get the dep from the cache
  const depMap = depCache.get(name);

  // if the dep is not in the cache, return null because it is not satisfied
  if (!depMap) return null;

  // now we get all the versions of the dep
  const versions = Object.keys(depMap);

  // clean the versions that are not semver
  const semverVersions = versions.filter((v) => !v.startsWith('file:'));

  // if there are no semver versions, return null because it is not satisfied
  if (!semverVersions.length) return null;

  // if there are semver versions, check if any of them satisfy the version
  const satisfiesVersion = semverVersions.find((v) => satisfies(v, version));

  // if there is a version that satisfies the version, check if the path is the same as the baseDir
  if (satisfiesVersion) {
    const dep = depMap[satisfiesVersion];
    if (dep.path === baseDir) {
      // if the path is the same as the baseDir, return "satisfies"
      return 'satisfies';
    } else {
      // if the path is not the same as the baseDir, return the path
      return dep.path;
    }
  }

  // if there are no semver versions that satisfy the version, return null because it is not satisfied
  return null;
}

export type Dep = {
  [key: string]: {
    spec: string;
    parent?: string[] | undefined;
    optional?: boolean | undefined;
    path: string;
    type: DependencyType;
    tarball?: string | undefined;
    sha?: string | undefined;
  };
};

export type DependencyMap = Map<string, Dep>;
