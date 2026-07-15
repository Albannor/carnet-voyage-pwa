import type { TravelDocumentV1 } from '../../contracts/voyage/v1/document'
import { toTravel } from '../../contracts/voyage/v1/toTravel'
import type { SupportedTravelDocument } from '../../contracts/voyage/registry'
import type { TravelDocumentV1_1 } from '../../contracts/voyage/v1_1/document'
import { toTravelV1_1 } from '../../contracts/voyage/v1_1/toTravel'
import type { Travel } from '../../domain/voyage/model'
import { importIssue, type ImportIssue } from '../errors'

export type TravelNormalizer = (document: SupportedTravelDocument) => Travel
export type TravelNormalizerRegistry = Readonly<Record<string, TravelNormalizer>>

export const TRAVEL_NORMALIZERS: TravelNormalizerRegistry = Object.freeze({
  '1.0.0': (document) => toTravel(document as TravelDocumentV1),
  '1.1.0': (document) => toTravelV1_1(document as TravelDocumentV1_1),
})

export type TravelNormalizationResult =
  | { ok: true; travel: Travel }
  | { ok: false; issue: ImportIssue }

export function hasTravelNormalizer(version: string) {
  return Object.hasOwn(TRAVEL_NORMALIZERS, version)
}

export function normalizeTravelDocument(
  version: string,
  document: SupportedTravelDocument,
  registry: TravelNormalizerRegistry = TRAVEL_NORMALIZERS,
): TravelNormalizationResult {
  const normalizer = registry[version]
  if (!normalizer) {
    return {
      ok: false,
      issue: importIssue(
        'migration',
        'MIGRATION_UNAVAILABLE',
        `Aucune normalisation n'est disponible pour voyage.json ${version}.`,
        {
          file: 'voyage.json',
          field: '/contentModelVersion',
          hint: 'Utilisez une version de voyage prise en charge par cette application.',
        },
      ),
    }
  }

  try {
    return { ok: true, travel: normalizer(document) }
  } catch {
    return {
      ok: false,
      issue: importIssue(
        'migration',
        'MIGRATION_FAILED',
        `La normalisation de voyage.json ${version} a échoué.`,
        {
          file: 'voyage.json',
          field: '/contentModelVersion',
          hint: 'Recréez le paquet avec une version compatible.',
        },
      ),
    }
  }
}
