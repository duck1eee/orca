import { z } from 'zod'
import { ORCA_VM_RECIPE_ID_PATTERN } from './orca-vm-recipe-id'

/**
 * Where `worktree create --on` puts a workspace. An existing host runs it as today; a provider
 * creates a new host (an environment) for the workspace first.
 *   local | ssh:<id> | runtime:<id> | <host name>   existing host (the values --host takes)
 *   recipe:<id>                                     orca.yaml environment recipe of the target repo
 *   plugin:<pluginKey>/<id>                         recipe from an approved plugin
 *   provider:<id> | <reserved id>                   a built-in provider
 */
export type WorkspaceProviderTarget =
  | { kind: 'recipe'; id: string }
  | { kind: 'plugin'; pluginKey: string; id: string }
  | { kind: 'provider'; id: string }

export type ParsedWorkspaceTarget =
  | { kind: 'host'; host: string }
  | { kind: 'provider'; target: WorkspaceProviderTarget }

/** Built-in provider ids that may be spelled without `provider:`. Empty until one ships: a reserved
 *  name would stop `--on <name>` reaching a host of that name, so it is reserved with the provider. */
export const RESERVED_PROVIDER_IDS: readonly string[] = []

// Recipe ids follow orca.yaml's rule, so a target round-trips through shells, JSON and errors unquoted.
const ID = ORCA_VM_RECIPE_ID_PATTERN

export const WorkspaceProviderTargetSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('recipe'), id: z.string().regex(ID) }).strict(),
  z
    .object({
      kind: z.literal('plugin'),
      pluginKey: z.string().min(1).max(256),
      id: z.string().regex(ID)
    })
    .strict(),
  z.object({ kind: z.literal('provider'), id: z.string().regex(ID) }).strict()
])

/** Throws a user-facing Error for a malformed provider target; anything else is a host. */
export function parseWorkspaceTarget(raw: string): ParsedWorkspaceTarget {
  const value = raw.trim()
  const prefixed = (prefix: string): string | null =>
    value.startsWith(prefix) ? value.slice(prefix.length) : null
  const recipe = prefixed('recipe:')
  if (recipe !== null) {
    return { kind: 'provider', target: { kind: 'recipe', id: requireId(recipe, value) } }
  }
  const plugin = prefixed('plugin:')
  if (plugin !== null) {
    const slash = plugin.lastIndexOf('/')
    if (slash <= 0) {
      throw new Error(`"${value}" must name a plugin and its recipe: plugin:<plugin>/<recipe-id>.`)
    }
    return {
      kind: 'provider',
      target: {
        kind: 'plugin',
        pluginKey: plugin.slice(0, slash),
        id: requireId(plugin.slice(slash + 1), value)
      }
    }
  }
  const provider = prefixed('provider:')
  if (provider !== null) {
    return { kind: 'provider', target: { kind: 'provider', id: requireId(provider, value) } }
  }
  if (RESERVED_PROVIDER_IDS.includes(value)) {
    return { kind: 'provider', target: { kind: 'provider', id: value } }
  }
  if (!value) {
    throw new Error(
      '--on needs a target: local, a host from `orca host list`, or a provider from `orca provider list`.'
    )
  }
  return { kind: 'host', host: value }
}

function requireId(id: string, whole: string): string {
  if (!ID.test(id)) {
    throw new Error(
      `"${whole}" is not a valid target; ids are lowercase letters, digits, '.', '_' and '-' (up to 64).`
    )
  }
  return id
}

/** The canonical spelling `provider list` prints and errors echo back. */
export function formatWorkspaceProviderTarget(target: WorkspaceProviderTarget): string {
  switch (target.kind) {
    case 'recipe':
      return `recipe:${target.id}`
    case 'plugin':
      return `plugin:${target.pluginKey}/${target.id}`
    case 'provider':
      return RESERVED_PROVIDER_IDS.includes(target.id) ? target.id : `provider:${target.id}`
  }
}
