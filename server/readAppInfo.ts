import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

interface AppInfo {
  version: string;
  changelog: string;
}

export function readAppInfo(): AppInfo {
  const pkgPath = path.join(__dirname, 'package.json');
  const changelogPath = path.join(__dirname, 'CHANGELOG.md');
  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8')) as { version?: string };
  const changelog = fs.existsSync(changelogPath)
    ? fs.readFileSync(changelogPath, 'utf8')
    : '# Release notes\n\n_Release notes are not bundled with this build._\n';
  return {
    version: pkg.version || '0.0.0',
    changelog,
  };
}
