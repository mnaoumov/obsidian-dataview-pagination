import { registerDemoVaultCoverageSuite } from '@mnaoumov/obsidian-dev-toolkit/demo-vault-coverage';
import { getRootFolder } from '@mnaoumov/typescript-dev-toolkit/root';
import process from 'node:process';

// Keeps the in-repo `demo-vault/` honest without launching Obsidian, and fails when a setting is documented nowhere.
registerDemoVaultCoverageSuite({
  configInterfaces: [{ interfaceName: 'PluginSettings', sourcePath: 'src/plugin-settings.ts' }],
  rootFolder: getRootFolder() ?? process.cwd()
});
