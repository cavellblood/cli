import {system} from '@shopify/cli-kit'
import {HomeConfigurationCommands} from 'cli/models/app/app'
import {Writable} from 'node:stream'
import {Home} from '$cli/models/app/app'

interface HomeOptions {
  home: Home
  stdout: Writable
  stderr: Writable
  signal: AbortSignal
  colors: boolean
}

export default async function home(
  command: HomeConfigurationCommands,
  {home, stdout, stderr, signal, colors}: HomeOptions,
): Promise<void> {
  const script = home.configuration.commands[command]
  if (!script) {
    return
  }

  const [cmd, ...args] = script.split(' ')
  await system.exec(cmd, args, {cwd: home.directory, stdout, stderr, colors, signal})
  stdout.write('Home successfully built.')
}
