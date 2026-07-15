import type { TravelDocumentV1_1 } from '../v1_1/document'

export const TRAVEL_CONTENT_MODEL_VERSION_1_2 = '1.2.0' as const

export type ChecklistTargetDocumentV1_2 =
  | { type: 'travel' }
  | { type: 'day'; dayId: string }
  | { type: 'step'; stepId: string }

export interface ChecklistItemDocumentV1_2 {
  id: string
  label: string
  description?: string
}

export interface ChecklistDocumentV1_2 {
  id: string
  title: string
  description?: string
  target: ChecklistTargetDocumentV1_2
  items: ChecklistItemDocumentV1_2[]
}

export interface TravelDocumentV1_2
  extends Omit<TravelDocumentV1_1, 'contentModelVersion'> {
  contentModelVersion: typeof TRAVEL_CONTENT_MODEL_VERSION_1_2
  checklists?: ChecklistDocumentV1_2[]
}
