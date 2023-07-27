import {gql} from 'graphql-request'

export const DevSessionCreateMutation = gql`
  mutation DevSessionCreate($title: String!, $scopes: [String!], $applicationUrl: String!) {
    devSessionCreate(input: {title: $title, scopes: $scopes, application: $applicationUrl}) {
      app {
        apiKey
        title
        id
      }
    }
  }
`

export interface DevSessionCreateVariables {
  title: string
  scopes: string[]
  applicationUrl: string
}

export interface DevSessionCreateSchema {
  devSessionCreate: {
    app: {
      apiKey: string
      title: string
      id: string
    }
    userErrors: {
      field: string[]
      message: string
    }[]
  }
}
