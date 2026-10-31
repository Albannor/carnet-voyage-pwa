import { useEffect, useState } from 'react'
import type { UserPieceMetadata } from '../../persistence/model'
import type { ActionProps, UserPieceFileLoadResult } from './consultationTypes'

type LocalImageState =
  | { readonly key: string; readonly status: 'ready'; readonly source: string }
  | { readonly key: string; readonly status: 'failed' }

/** Charge une image locale du voyage et révoque son URL d’objet au démontage. */
export function useLocalImageSource(
  travelId: string,
  resourceId: string,
  onLoadResource: ActionProps['onLoadIllustrationResource'],
) {
  const resourceKey = `${travelId}/${resourceId}`
  const [resourceState, setResourceState] = useState<LocalImageState>()

  useEffect(() => {
    let active = true
    let objectUrl: string | undefined
    void onLoadResource(travelId, resourceId).then((result) => {
      if (!active) return
      if (!result.ok) {
        setResourceState({ key: resourceKey, status: 'failed' })
        return
      }
      try {
        objectUrl = URL.createObjectURL(new Blob(
          [Uint8Array.from(result.resource.bytes).buffer],
          { type: result.resource.mediaType },
        ))
        if (!active) {
          URL.revokeObjectURL(objectUrl)
          return
        }
        setResourceState({ key: resourceKey, status: 'ready', source: objectUrl })
      } catch {
        setResourceState({ key: resourceKey, status: 'failed' })
      }
    })

    return () => {
      active = false
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [onLoadResource, resourceId, resourceKey, travelId])

  return resourceState?.key === resourceKey ? resourceState : undefined
}

/** Ressources réellement présentes sur l’appareil ; `undefined` tant qu’elles sont inconnues. */
export function useLocalResourceIds(
  travelId: string,
  onListLocalResourceIds: (travelId: string) => Promise<readonly string[] | undefined>,
) {
  const [localResourceIds, setLocalResourceIds] = useState<ReadonlySet<string>>()

  useEffect(() => {
    let active = true
    void onListLocalResourceIds(travelId).then((ids) => {
      if (active) setLocalResourceIds(ids ? new Set(ids) : undefined)
    })
    return () => {
      active = false
    }
  }, [onListLocalResourceIds, travelId])

  return localResourceIds
}

type UserPieceImageState =
  | { readonly key: string; readonly status: 'ready'; readonly source: string }
  | { readonly key: string; readonly status: 'failed' }

/** Charge une image ajoutée et révoque son URL d’objet au démontage. */
export function useUserPieceImage(
  travelId: string,
  piece: UserPieceMetadata | undefined,
  onLoadUserPieceFile: (travelId: string, pieceId: string) => Promise<UserPieceFileLoadResult>,
) {
  const pieceId = piece && piece.mediaType !== 'application/pdf' ? piece.pieceId : undefined
  const key = `${travelId}/${pieceId ?? ''}`
  const [state, setState] = useState<UserPieceImageState>()

  useEffect(() => {
    if (!pieceId) return
    let active = true
    let objectUrl: string | undefined
    void onLoadUserPieceFile(travelId, pieceId).then((result) => {
      if (!active) return
      if (!result.ok || result.file.mediaType === 'application/pdf') {
        setState({ key, status: 'failed' })
        return
      }
      try {
        objectUrl = URL.createObjectURL(new Blob(
          [Uint8Array.from(result.file.bytes).buffer],
          { type: result.file.mediaType },
        ))
        setState({ key, status: 'ready', source: objectUrl })
      } catch {
        setState({ key, status: 'failed' })
      }
    })
    return () => {
      active = false
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [key, onLoadUserPieceFile, pieceId, travelId])

  return state?.key === key ? state : undefined
}
