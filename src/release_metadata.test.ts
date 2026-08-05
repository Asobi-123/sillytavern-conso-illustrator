import {readFileSync} from 'node:fs';
import {describe, expect, it} from 'vitest';
import {EXTENSION_VERSION} from './constants';

function readProjectFile(relativePath: string): string {
  return readFileSync(new URL(relativePath, import.meta.url), 'utf8');
}

describe('release metadata', () => {
  it('keeps the runtime, package, and extension manifest versions aligned', () => {
    const packageJson = JSON.parse(readProjectFile('../package.json')) as {
      version: string;
    };
    const manifest = JSON.parse(readProjectFile('../manifest.json')) as {
      version: string;
    };

    expect(packageJson.version).toBe(EXTENSION_VERSION);
    expect(manifest.version).toBe(EXTENSION_VERSION);
  });

  it('ships the runtime version in the built bundle', () => {
    const bundle = readProjectFile('../dist/index.js');

    expect(bundle).toContain(EXTENSION_VERSION);
  });
});
