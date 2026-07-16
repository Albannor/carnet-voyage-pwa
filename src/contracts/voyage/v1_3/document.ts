import type { TravelDocumentV1_2 } from '../v1_2/document'

export const TRAVEL_CONTENT_MODEL_VERSION_1_3 = '1.3.0' as const

export type LicensedIllustrationProvenanceDocumentV1_3 = {
  type: 'licensed'
  creator: string
  sourceUrl: string
  licenseCode: string
  licenseUrl: string
  modified: boolean
}

export type UserProvidedIllustrationProvenanceDocumentV1_3 = {
  type: 'user-provided'
  credit?: string
}

export type AiGeneratedIllustrationProvenanceDocumentV1_3 = {
  type: 'ai-generated'
  provider: string
  generatedAt?: string
}

export type IllustrationProvenanceDocumentV1_3 =
  | LicensedIllustrationProvenanceDocumentV1_3
  | UserProvidedIllustrationProvenanceDocumentV1_3
  | AiGeneratedIllustrationProvenanceDocumentV1_3

export interface IllustrationDocumentV1_3 {
  id: string
  resourceId: string
  alt: string
  caption?: string
  provenance: IllustrationProvenanceDocumentV1_3
}

type LegacyDay = TravelDocumentV1_2['days'][number]
type LegacyStep = LegacyDay['steps'][number]

export interface StepDocumentV1_3 extends LegacyStep {
  illustrationIds?: string[]
}

export interface DayDocumentV1_3 extends Omit<LegacyDay, 'steps'> {
  steps: StepDocumentV1_3[]
  illustrationIds?: string[]
}

export interface TravelDocumentV1_3
  extends Omit<TravelDocumentV1_2, 'contentModelVersion' | 'days'> {
  contentModelVersion: typeof TRAVEL_CONTENT_MODEL_VERSION_1_3
  days: DayDocumentV1_3[]
  illustrations?: IllustrationDocumentV1_3[]
  coverIllustrationId?: string
}
