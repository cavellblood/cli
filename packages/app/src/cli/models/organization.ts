import {SpecsAppConfiguration} from './extensions/specifications/types/app_config.js'
import {BetaFlag} from '../services/dev/fetch.js'

export interface Organization {
  id: string
  businessName: string
  website?: string
}

export interface MinimalOrganizationApp {
  id: string
  title: string
  apiKey: string
  organizationId: string
}

export interface MinimalRunEvent {
  type: 'function-run'
  payload: {
    input: string
    invocationId: string
  }
}

export type OrganizationApp = MinimalOrganizationApp & {
  apiSecretKeys: {
    secret: string
  }[]
  appType?: string
  newApp?: boolean
  grantedScopes: string[]
  developmentStorePreviewEnabled?: boolean
  configuration?: SpecsAppConfiguration
  betas: BetaFlag[]
}

export interface OrganizationStore {
  shopId: string
  link: string
  shopDomain: string
  shopName: string
  transferDisabled: boolean
  convertableToPartnerTest: boolean
}
