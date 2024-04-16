import {AppErrors, isWebType} from './loader.js'
import {ensurePathStartsWithSlash} from './validation/common.js'
import {ExtensionInstance} from '../extensions/extension-instance.js'
import {isType} from '../../utilities/types.js'
import {FunctionConfigType} from '../extensions/specifications/function.js'
import {ExtensionSpecification} from '../extensions/specification.js'
import {SpecsAppConfiguration} from '../extensions/specifications/types/app_config.js'
import {Flag} from '../../services/dev/fetch.js'
import {zod} from '@shopify/cli-kit/node/schema'
import {DotEnvFile} from '@shopify/cli-kit/node/dot-env'
import {getDependencies, PackageManager, readAndParsePackageJson} from '@shopify/cli-kit/node/node-package-manager'
import {fileRealPath, findPathUp} from '@shopify/cli-kit/node/fs'
import {joinPath} from '@shopify/cli-kit/node/path'
import {AbortError} from '@shopify/cli-kit/node/error'
import {setPathValue} from '@shopify/cli-kit/common/object'
import {
  EditorExtensionCollectionType,
  makeExtensionsInCollection,
} from '../extensions/specifications/editor_extension_collection.js'
import {UIExtensionSchema} from '../extensions/specifications/ui_extension.js'

export const LegacyAppSchema = zod
  .object({
    client_id: zod.number().optional(),
    name: zod.string().optional(),
    scopes: zod.string().default(''),
    extension_directories: zod.array(zod.string()).optional(),
    web_directories: zod.array(zod.string()).optional(),
  })
  .strict()

export const AppSchema = zod.object({
  client_id: zod.string(),
  organization_id: zod.string().optional(),
  build: zod
    .object({
      automatically_update_urls_on_dev: zod.boolean().optional(),
      dev_store_url: zod.string().optional(),
      include_config_on_deploy: zod.boolean().optional(),
    })
    .optional(),
  extension_directories: zod.array(zod.string()).optional(),
  web_directories: zod.array(zod.string()).optional(),
})

export const AppConfigurationSchema = zod.union([LegacyAppSchema, AppSchema])

export function getAppVersionedSchema(specs: ExtensionSpecification[], allowDynamicallySpecifiedConfigs = false) {
  const isConfigSpecification = (spec: ExtensionSpecification) => spec.experience === 'configuration'
  const schema = specs
    .filter(isConfigSpecification)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .reduce((schema, spec) => schema.merge(spec.schema), AppSchema as any)

  if (allowDynamicallySpecifiedConfigs) {
    return schema.passthrough()
  } else {
    return specs.length > 0 ? schema.strict() : schema
  }
}

/**
 * Check whether a shopify.app.toml schema is valid against the legacy schema definition.
 * @param item - the item to validate
 */
export function isLegacyAppSchema(item: AppConfiguration): item is LegacyAppConfiguration {
  const {path, ...rest} = item
  return isType(LegacyAppSchema, rest)
}

/**
 * Check whether a shopify.app.toml schema is valid against the current schema definition.
 * @param item - the item to validate
 */
export function isCurrentAppSchema(item: AppConfiguration): item is CurrentAppConfiguration {
  const {path, ...rest} = item
  return isType(AppSchema.nonstrict(), rest)
}

/**
 * Get scopes from a given app.toml config file.
 * @param config - a configuration file
 */
export function getAppScopes(config: AppConfiguration): string {
  if (isLegacyAppSchema(config)) {
    return config.scopes
  } else if (isCurrentAppSchema(config)) {
    return config.access_scopes?.scopes ?? ''
  }
  return ''
}

/**
 * Get scopes as an array from a given app.toml config file.
 * @param config - a configuration file
 */
export function getAppScopesArray(config: AppConfiguration) {
  const scopes = getAppScopes(config)
  return scopes.length ? scopes.split(',').map((scope) => scope.trim()) : []
}

export function usesLegacyScopesBehavior(config: AppConfiguration) {
  if (isLegacyAppSchema(config)) return true
  if (isCurrentAppSchema(config)) return config.access_scopes?.use_legacy_install_flow ?? false
  return false
}

export function appIsLaunchable(app: AppInterface) {
  const frontendConfig = app?.webs?.find((web) => isWebType(web, WebType.Frontend))
  const backendConfig = app?.webs?.find((web) => isWebType(web, WebType.Backend))

  return Boolean(frontendConfig || backendConfig)
}

export function filterNonVersionedAppFields(configuration: {[key: string]: unknown}) {
  return Object.keys(configuration).filter(
    (fieldName) => !Object.keys(AppSchema.shape).concat('path').includes(fieldName),
  )
}

export enum WebType {
  Frontend = 'frontend',
  Backend = 'backend',
  Background = 'background',
}

const WebConfigurationAuthCallbackPathSchema = zod.preprocess(ensurePathStartsWithSlash, zod.string())

const baseWebConfigurationSchema = zod.object({
  auth_callback_path: zod
    .union([WebConfigurationAuthCallbackPathSchema, WebConfigurationAuthCallbackPathSchema.array()])
    .optional(),
  webhooks_path: zod.preprocess(ensurePathStartsWithSlash, zod.string()).optional(),
  port: zod.number().max(65536).min(0).optional(),
  commands: zod.object({
    build: zod.string().optional(),
    dev: zod.string(),
  }),
  name: zod.string().optional(),
  hmr_server: zod.object({http_paths: zod.string().array()}).optional(),
})
const webTypes = zod.enum([WebType.Frontend, WebType.Backend, WebType.Background]).default(WebType.Frontend)
export const WebConfigurationSchema = zod.union([
  baseWebConfigurationSchema.extend({roles: zod.array(webTypes)}),
  baseWebConfigurationSchema.extend({type: webTypes}),
])
export const ProcessedWebConfigurationSchema = baseWebConfigurationSchema.extend({roles: zod.array(webTypes)})

export type AppConfiguration = zod.infer<typeof AppConfigurationSchema> & {path: string}
export type CurrentAppConfiguration = zod.infer<typeof AppSchema> & {path: string} & SpecsAppConfiguration
export type LegacyAppConfiguration = zod.infer<typeof LegacyAppSchema> & {path: string}
export type WebConfiguration = zod.infer<typeof WebConfigurationSchema>
export type ProcessedWebConfiguration = zod.infer<typeof ProcessedWebConfigurationSchema>
export type WebConfigurationCommands = keyof WebConfiguration['commands']

export interface Web {
  directory: string
  configuration: ProcessedWebConfiguration
  framework?: string
}

export interface AppConfigurationInterface {
  directory: string
  configuration: AppConfiguration
  configSchema: zod.ZodTypeAny
}

export interface AppInterface extends AppConfigurationInterface {
  name: string
  idEnvironmentVariableName: string
  packageManager: PackageManager
  nodeDependencies: {[key: string]: string}
  webs: Web[]
  usesWorkspaces: boolean
  dotenv?: DotEnvFile
  allExtensions: ExtensionInstance[]
  draftableExtensions: ExtensionInstance[]
  specifications?: ExtensionSpecification[]
  errors?: AppErrors
  includeConfigOnDeploy: boolean | undefined
  remoteFlags: Flag[]
  hasExtensions: () => boolean
  updateDependencies: () => Promise<void>
  extensionsForType: (spec: {identifier: string; externalIdentifier: string}) => ExtensionInstance[]
  updateExtensionUUIDS: (uuids: {[key: string]: string}) => void
  preDeployValidation: () => Promise<void>
}

interface AppConstructor {
  name: string
  idEnvironmentVariableName: string
  directory: string
  packageManager: PackageManager
  configuration: AppConfiguration
  nodeDependencies: {[key: string]: string}
  webs: Web[]
  modules: ExtensionInstance[]
  usesWorkspaces: boolean
  dotenv?: DotEnvFile
  errors?: AppErrors
  specifications?: ExtensionSpecification[]
  configSchema?: zod.ZodTypeAny
  remoteFlags?: Flag[]
}

export class App implements AppInterface {
  name: string
  idEnvironmentVariableName: string
  directory: string
  packageManager: PackageManager
  configuration: AppConfiguration
  nodeDependencies: {[key: string]: string}
  webs: Web[]
  usesWorkspaces: boolean
  dotenv?: DotEnvFile
  errors?: AppErrors
  specifications?: ExtensionSpecification[]
  configSchema: zod.ZodTypeAny
  remoteFlags: Flag[]
  private realExtensions: ExtensionInstance[]

  constructor({
    name,
    idEnvironmentVariableName,
    directory,
    packageManager,
    configuration,
    nodeDependencies,
    webs,
    modules,
    usesWorkspaces,
    dotenv,
    errors,
    specifications,
    configSchema,
    remoteFlags,
  }: AppConstructor) {
    this.name = name
    this.idEnvironmentVariableName = idEnvironmentVariableName
    this.directory = directory
    this.packageManager = packageManager
    this.configuration = this.configurationTyped(configuration)
    this.nodeDependencies = nodeDependencies
    this.webs = webs
    this.dotenv = dotenv
    this.realExtensions = modules
    this.errors = errors
    this.usesWorkspaces = usesWorkspaces
    this.specifications = specifications
    this.configSchema = configSchema ?? AppSchema
    this.remoteFlags = remoteFlags ?? []
  }

  get allExtensions() {
    if (!this.remoteFlags.includes(Flag.DeclarativeWebhooks)) {
      this.filterDeclarativeWebhooksConfig()
    }

    if (this.includeConfigOnDeploy) return this.realExtensions
    return this.realExtensions.filter((ext) => !ext.isAppConfigExtension)
  }

  get draftableExtensions() {
    return this.realExtensions.filter((ext) => ext.isDraftable())
  }

  async updateDependencies() {
    const nodeDependencies = await getDependencies(joinPath(this.directory, 'package.json'))
    this.nodeDependencies = nodeDependencies
  }

  async preDeployValidation() {
    const functionExtensionsWithUiHandle = this.allExtensions.filter(
      (ext) => ext.isFunctionExtension && (ext.configuration as unknown as FunctionConfigType).ui?.handle,
    ) as ExtensionInstance<FunctionConfigType>[]

    if (functionExtensionsWithUiHandle.length > 0) {
      const errors = validateFunctionExtensionsWithUiHandle(functionExtensionsWithUiHandle, this.allExtensions)
      if (errors) {
        throw new AbortError('Invalid function configuration', errors.join('\n'))
      }
    }

    const extensionCollections = this.allExtensions.filter(
      (ext) => ext.isEditorExtensionCollection,
    ) as ExtensionInstance<EditorExtensionCollectionType>[]

    if (extensionCollections.length > 0) {
      const errors = validateExtensionsHandlesInCollection(extensionCollections, this.allExtensions)
      if (errors) {
        throw new AbortError('Invalid extension collection configuration', errors.join('\n'))
      }
    }

    await Promise.all([this.allExtensions.map((ext) => ext.preDeployValidation())])
  }

  hasExtensions(): boolean {
    return this.allExtensions.length > 0
  }

  extensionsForType(specification: {identifier: string; externalIdentifier: string}): ExtensionInstance[] {
    return this.allExtensions.filter(
      (extension) => extension.type === specification.identifier || extension.type === specification.externalIdentifier,
    )
  }

  updateExtensionUUIDS(uuids: {[key: string]: string}) {
    this.allExtensions.forEach((extension) => {
      extension.devUUID = uuids[extension.localIdentifier] ?? extension.devUUID
    })
  }

  get includeConfigOnDeploy() {
    if (isLegacyAppSchema(this.configuration)) return false
    return this.configuration.build?.include_config_on_deploy
  }

  private configurationTyped(configuration: AppConfiguration) {
    if (isLegacyAppSchema(configuration)) return configuration
    return configuration as CurrentAppConfiguration & SpecsAppConfiguration
  }

  private filterDeclarativeWebhooksConfig() {
    const webhooksConfigIndex = this.realExtensions.findIndex((ext) => ext.handle === 'webhooks')
    const complianceWebhooksConfigIndex = this.realExtensions.findIndex(
      (ext) => ext.handle === 'privacy-compliance-webhooks',
    )

    if (webhooksConfigIndex > -1) {
      setPathValue(this.realExtensions, `${webhooksConfigIndex}.configuration.webhooks.subscriptions`, [])
    }

    if (complianceWebhooksConfigIndex > -1) {
      setPathValue(this.realExtensions, `${complianceWebhooksConfigIndex}.configuration.webhooks.subscriptions`, [])
    }
  }
}

export function validateFunctionExtensionsWithUiHandle(
  functionExtensionsWithUiHandle: ExtensionInstance<FunctionConfigType>[],
  allExtensions: ExtensionInstance[],
): string[] | undefined {
  const errors: string[] = []

  functionExtensionsWithUiHandle.forEach((extension) => {
    const uiHandle = extension.configuration.ui!.handle!

    const matchingExtension = findExtensionByHandle(allExtensions, uiHandle)
    if (!matchingExtension) {
      errors.push(`[${extension.name}] - Local app must contain a ui_extension with handle '${uiHandle}'`)
    } else if (matchingExtension.configuration.type !== 'ui_extension') {
      errors.push(
        `[${extension.name}] - Local app must contain one extension of type 'ui_extension' and handle '${uiHandle}'`,
      )
    }
  })

  return errors.length > 0 ? errors : undefined
}

export type UIExtensionType = zod.infer<typeof UIExtensionSchema>

export function validateExtensionsHandlesInCollection(
  editorExtensionCollections: ExtensionInstance<EditorExtensionCollectionType>[],
  allExtensions: ExtensionInstance[],
): string[] | undefined {
  const errors: string[] = []

  let allowableTypesForExtensionInCollection = ['ui_extension']
  editorExtensionCollections.forEach((collection) => {
    const extensionsInCollection = makeExtensionsInCollection(collection.configuration)

    extensionsInCollection.forEach((extension) => {
      const matchingExtension = findExtensionByHandle(allExtensions, extension.handle)

      if (!matchingExtension) {
        errors.push(
          `[${collection.handle}] extension collection - Local app must contain an extension with handle '${extension.handle}'`,
        )
      } else if (!allowableTypesForExtensionInCollection.includes(matchingExtension.specification.identifier)) {
        errors.push(
          `[${collection.handle}] extension collection - The collection can't contain an extension of type '${matchingExtension.specification.identifier}'`,
        )
      } else if (matchingExtension.specification.identifier === 'ui_extension') {
        const uiExtension = matchingExtension as ExtensionInstance<UIExtensionType>
        uiExtension.configuration.extension_points.forEach((extensionPoint) => {
          if (extensionPoint.target.startsWith('admin.')) {
            errors.push(
              `[${collection.handle}] extension collection - The collection can't contain an extension of type '${matchingExtension.specification.identifier}' with target ${extensionPoint.target}`,
            )
          }
        })
      }
    })
  })

  return errors.length > 0 ? errors : undefined
}

function findExtensionByHandle(allExtensions: ExtensionInstance[], handle: string): ExtensionInstance | undefined {
  return allExtensions.find((ext) => ext.handle === handle)
}

export class EmptyApp extends App {
  constructor(specifications?: ExtensionSpecification[], flags?: Flag[], clientId?: string) {
    const configuration = clientId
      ? {client_id: clientId, access_scopes: {scopes: ''}, path: ''}
      : {scopes: '', path: ''}
    const configSchema = getAppVersionedSchema(specifications ?? [])
    super({
      name: '',
      idEnvironmentVariableName: '',
      directory: '',
      packageManager: 'npm',
      configuration,
      nodeDependencies: {},
      webs: [],
      modules: [],
      usesWorkspaces: false,
      specifications,
      configSchema,
      remoteFlags: flags ?? [],
    })
  }
}

type RendererVersionResult = {name: string; version: string} | undefined | 'not_found'

/**
 * Given a UI extension, it returns the version of the renderer package.
 * Looks for `/node_modules/@shopify/{renderer-package-name}/package.json` to find the real version used.
 * @param extension - UI extension whose renderer version will be obtained.
 * @returns The version if the dependency exists.
 */
export async function getUIExtensionRendererVersion(extension: ExtensionInstance): Promise<RendererVersionResult> {
  // Look for the vanilla JS version of the dependency (the react one depends on it, will always be present)
  const rendererDependency = extension.dependency
  if (!rendererDependency) return undefined
  return getDependencyVersion(rendererDependency, extension.directory)
}

export async function getDependencyVersion(dependency: string, directory: string): Promise<RendererVersionResult> {
  // Split the dependency name to avoid using "/" in windows. Only look for non react dependencies.
  const dependencyName = dependency.replace('-react', '').split('/')
  const pattern = joinPath('node_modules', dependencyName[0]!, dependencyName[1]!, 'package.json')

  let packagePath = await findPathUp(pattern, {
    cwd: directory,
    type: 'file',
    allowSymlinks: true,
  })
  if (!packagePath) return 'not_found'
  packagePath = await fileRealPath(packagePath)

  // Load the package.json and extract the version
  const packageContent = await readAndParsePackageJson(packagePath)
  if (!packageContent.version) return 'not_found'
  return {name: dependency, version: packageContent.version}
}
