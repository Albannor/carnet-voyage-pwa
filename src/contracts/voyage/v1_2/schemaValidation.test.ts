import { describe, expect, it } from 'vitest'
import validTravel from '../../../../examples/voyage/1.2.0/valid/coastal-checklists.json'
import invalidCases from '../../../../examples/voyage/1.2.0/invalid/checklist-cases.json'
import { validateTravelDocumentSchemaV1_2 } from './schemaValidation'

function invalidWith(checklists: unknown[]) {
  return { ...structuredClone(validTravel), checklists }
}

describe('contrat voyage.json 1.2.0', () => {
  it('accepte les cibles voyage, journée et étape', () => {
    const result = validateTravelDocumentSchemaV1_2(validTravel)
    expect(result.valid).toBe(true)
    if (!result.valid) throw new Error(JSON.stringify(result.issues))
    expect(result.document.checklists?.map((checklist) => checklist.target.type)).toEqual([
      'travel', 'day', 'step',
    ])
  })

  it('refuse les propriétés inconnues, y compris du HTML actif', () => {
    const checklist = structuredClone(invalidCases.unknownProperty)
    const result = validateTravelDocumentSchemaV1_2(invalidWith([checklist]))
    expect(result.valid).toBe(false)
    if (result.valid) throw new Error('Le document aurait dû être refusé.')
    expect(result.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: 'SCHEMA_UNKNOWN_PROPERTY', path: '/checklists/0/items/0/html' }),
      expect.objectContaining({ code: 'FORBIDDEN_PRESENTATION_FIELD', path: '/checklists/0/items/0/html' }),
    ]))
  })

  it('refuse une cible incohérente', () => {
    const checklist = structuredClone(validTravel.checklists[0]) as Record<string, unknown>
    checklist.target = structuredClone(invalidCases.incoherentTarget)
    const result = validateTravelDocumentSchemaV1_2(invalidWith([checklist]))
    expect(result.valid).toBe(false)
    if (result.valid) throw new Error('La cible aurait dû être refusée.')
    expect(result.issues).toContainEqual(expect.objectContaining({
      code: 'SCHEMA_UNKNOWN_PROPERTY', path: '/checklists/0/target/stepId',
    }))
  })

  it('applique cardinalités et limites de texte', () => {
    const checklist = structuredClone(validTravel.checklists[0])
    const oversized = { ...checklist, items: Array.from({ length: invalidCases.oversizedChecklist.itemCount }, (_, index) => ({ id: `item-${index}`, label: 'Élément' })) }
    const empty = { ...checklist, id: 'checklist-empty', title: invalidCases.invalidTexts.empty }
    const tooLong = { ...checklist, id: 'checklist-long', description: 'x'.repeat(invalidCases.invalidTexts.tooLongLength) }
    const result = validateTravelDocumentSchemaV1_2(invalidWith([oversized, empty, tooLong]))
    expect(result.valid).toBe(false)
    if (result.valid) throw new Error('Les limites auraient dû être appliquées.')
    expect(result.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({ path: '/checklists/0/items' }),
      expect.objectContaining({ path: '/checklists/1/title' }),
      expect.objectContaining({ path: '/checklists/2/description' }),
    ]))
  })
})
