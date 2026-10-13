const { readdir, writeFile, mkdir } = require('node:fs/promises');
const path = require('node:path');
module.exports = async context => {
  if (context.electronPlatformName !== 'win32') return;
  const files = [], directories = [];
  async function walk(folder, relative = '') {
    for (const entry of await readdir(folder, { withFileTypes: true })) {
      const name = path.join(relative, entry.name);
      if (entry.isDirectory()) { directories.push(name); await walk(path.join(folder, entry.name), name); }
      else if (entry.isFile()) files.push(name);
      else throw new Error('Unexpected link in Windows payload');
    }
  }
  await walk(context.appOutDir);
  const escape = value => value.split(path.sep).join('\\').replaceAll('$', '$$').replaceAll('"', '$\\"');
  const lines = files.sort().map(file => `Delete "$INSTDIR\\${escape(file)}"`);
  lines.push(...directories.sort((a, b) => b.length - a.length).map(folder => `RMDir "$INSTDIR\\${escape(folder)}"`));
  const release = path.join(context.packager.projectDir, 'release');
  await mkdir(release, { recursive: true });
  await writeFile(path.join(release, 'installed-files.nsh'), lines.join('\n') + '\n');
};
