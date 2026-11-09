import { describe, expect, it } from 'vitest'
import {
  WorkspaceProviderTargetSchema,
  formatWorkspaceProviderTarget,
  parseWorkspaceTarget
} from './workspace-provider-target'

describe('--on target parsing', () => {
  it.each([
    ['local', { kind: 'host', host: 'local' }],
    ['ssh:box', { kind: 'host', host: 'ssh:box' }],
    ['runtime:env-1', { kind: 'host', host: 'runtime:env-1' }],
    ['my-laptop', { kind: 'host', host: 'my-laptop' }],
    ['recipe:sandbox', { kind: 'provider', target: { kind: 'recipe', id: 'sandbox' } }],
    [
      'plugin:acme/gpu-box',
      { kind: 'provider', target: { kind: 'plugin', pluginKey: 'acme', id: 'gpu-box' } }
    ],
    ['provider:other', { kind: 'provider', target: { kind: 'provider', id: 'other' } }],
    // No built-in provider has shipped, so a bare name is always a host.
    ['cloud', { kind: 'host', host: 'cloud' }]
  ])('%s', (raw, expected) => {
    expect(parseWorkspaceTarget(raw)).toEqual(expected)
  })

  it.each([
    'recipe:',
    'recipe:has space',
    'recipe:Upper',
    'plugin:acme',
    'plugin:/x',
    'provider:',
    ''
  ])('refuses %j', (raw) => {
    expect(() => parseWorkspaceTarget(raw)).toThrow()
  })

  it('round-trips every provider kind through its canonical spelling and the wire schema', () => {
    for (const raw of ['recipe:sandbox', 'plugin:acme/gpu-box', 'provider:other']) {
      const parsed = parseWorkspaceTarget(raw)
      if (parsed.kind !== 'provider') {
        throw new Error('expected a provider')
      }
      expect(formatWorkspaceProviderTarget(parsed.target)).toBe(raw)
      expect(WorkspaceProviderTargetSchema.parse(parsed.target)).toEqual(parsed.target)
    }
  })
})
