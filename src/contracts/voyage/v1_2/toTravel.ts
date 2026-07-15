import type {
  Travel,
  TravelChecklist,
  TravelChecklistTarget,
} from '../../../domain/voyage/model'
import { toTravelV1_1 } from '../v1_1/toTravel'
import type {
  ChecklistDocumentV1_2,
  ChecklistTargetDocumentV1_2,
  TravelDocumentV1_2,
} from './document'

function toTarget(target: ChecklistTargetDocumentV1_2): TravelChecklistTarget {
  if (target.type === 'day') return { type: 'day', dayId: target.dayId }
  if (target.type === 'step') return { type: 'step', stepId: target.stepId }
  return { type: 'travel' }
}

function toChecklist(checklist: ChecklistDocumentV1_2): TravelChecklist {
  return {
    id: checklist.id,
    title: checklist.title,
    description: checklist.description,
    target: toTarget(checklist.target),
    items: checklist.items.map((item) => ({
      id: item.id,
      label: item.label,
      description: item.description,
    })),
  }
}

export function toTravelV1_2(document: TravelDocumentV1_2): Travel {
  const legacyShape = {
    ...document,
    contentModelVersion: '1.1.0' as const,
  }
  const normalized = toTravelV1_1(legacyShape)
  return {
    ...normalized,
    contentVersion: document.contentModelVersion,
    checklists: (document.checklists ?? []).map(toChecklist),
  }
}
