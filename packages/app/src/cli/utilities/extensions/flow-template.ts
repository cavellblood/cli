import {ExtensionInstance} from '../../models/extensions/extension-instance.js'
import {glob} from '@shopify/cli-kit/node/fs'
import {joinPath} from '@shopify/cli-kit/node/path'

const includedFilePatterns = ['*.flow', '*.json', '*.toml']

export async function flowTemplateExtensionFiles(themeExtension: ExtensionInstance): Promise<string[]> {
  const include = includedFilePatterns.map((pattern) => joinPath('**', pattern))
  return glob(include, {
    absolute: true,
    cwd: themeExtension.directory,
  })
}
