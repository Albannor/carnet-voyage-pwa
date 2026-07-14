import { describe, expect, it } from 'vitest'
import modelSource from './voyage/model.ts?raw'
import validationSource from './voyage/validation.ts?raw'

const domainSources = [modelSource, validationSource]

describe('frontière du domaine', () => {
  it('reste indépendant de React, de l’interface, du stockage et du contrat externe', () => {
    for (const source of domainSources) {
      expect(source).not.toMatch(/from\s+['"]react(?:\/[^'"]*)?['"]/)
      expect(source).not.toMatch(/(?:\/ui\/|\/persistence\/|\/contracts\/)/)
    }
  })
})
