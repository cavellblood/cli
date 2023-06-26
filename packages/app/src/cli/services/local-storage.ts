import {LocalStorage} from '@shopify/cli-kit/node/local-storage'
import {outputDebug, outputContent, outputToken} from '@shopify/cli-kit/node/output'
import {normalizePath} from '@shopify/cli-kit/node/path'

export interface CachedAppInfo {
  directory: string
  configFile?: string
  appId?: string
  title?: string
  orgId?: string
  storeFqdn?: string
  updateURLs?: boolean
  tunnelPlugin?: string
}

// We store each app info using the directory as the key
export interface AppLocalStorageSchema {
  [key: string]: CachedAppInfo
}

let _appLocalStorageInstance: LocalStorage<AppLocalStorageSchema> | undefined

function appLocalStorage() {
  if (!_appLocalStorageInstance) {
    _appLocalStorageInstance = new LocalStorage<AppLocalStorageSchema>({projectName: 'shopify-cli-app'})
  }
  return _appLocalStorageInstance
}

export function getAppInfo(
  directory: string,
  config: LocalStorage<AppLocalStorageSchema> = appLocalStorage(),
): CachedAppInfo | undefined {
  const normalized = normalizePath(directory)
  outputDebug(outputContent`Reading cached app information for directory ${outputToken.path(normalized)}...`)
  return config.get(normalized)
}

export function clearAppInfo(directory: string, config: LocalStorage<AppLocalStorageSchema> = appLocalStorage()): void {
  const normalized = normalizePath(directory)
  outputDebug(outputContent`Clearing app information for directory ${outputToken.path(normalized)}...`)
  config.delete(normalized)
}

export function clearAllAppInfo(config: LocalStorage<AppLocalStorageSchema> = appLocalStorage()): void {
  outputDebug(outputContent`Clearing all app information...`)
  config.clear()
}

export function setAppInfo(
  options: CachedAppInfo,
  config: LocalStorage<AppLocalStorageSchema> = appLocalStorage(),
): void {
  options.directory = normalizePath(options.directory)
  outputDebug(
    outputContent`Storing app information for directory ${outputToken.path(options.directory)}:${outputToken.json(
      options,
    )}`,
  )
  const savedApp = config.get(options.directory)
  if (savedApp) {
    config.set(options.directory, {
      ...savedApp,
      ...options,
    })
  } else {
    config.set(options.directory, options)
  }
}

export function setCurrentConfigFile(
  options: CachedAppInfo,
  config: LocalStorage<AppLocalStorageSchema> = appLocalStorage(),
): void {
  const normalized = normalizePath(options.directory)
  setAppInfo(options, config)
}

export function clearCurrentConfigFile(
  directory: string,
  config: LocalStorage<AppLocalStorageSchema> = appLocalStorage(),
): void {
  const normalized = normalizePath(directory)
  const savedApp = config.get(normalized)
  config.set(normalized, {
    ...savedApp,
    configFile: undefined,
  })
}
