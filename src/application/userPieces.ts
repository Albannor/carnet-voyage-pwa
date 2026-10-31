import {
  MAX_USER_PIECE_BYTES,
  detectUserPieceMediaType,
  type UserPieceKind,
  type UserPieceMediaType,
} from '../persistence/model'

export const USER_PIECE_KIND_LABELS: Readonly<Record<UserPieceKind, string>> = {
  transport: 'Transport',
  accommodation: 'Hébergement',
  activity: 'Activité',
  insurance: 'Assurance',
  other: 'Autre',
}

export const MAX_USER_PIECE_SIZE_LABEL = `${MAX_USER_PIECE_BYTES / (1024 * 1024)} Mo`

export type UserPieceFileReadResult =
  | {
      readonly ok: true
      readonly mediaType: UserPieceMediaType
      readonly bytes: Uint8Array
    }
  | { readonly ok: false; readonly message: string }

export function userPieceFormatLabel(mediaType: UserPieceMediaType) {
  return mediaType === 'application/pdf' ? 'PDF' : 'Image'
}

/**
 * Lit un fichier choisi ou photographié. La taille est contrôlée avant toute
 * lecture et le format est déterminé par la signature binaire, jamais par le
 * nom du fichier ni par le type annoncé par le navigateur.
 */
export async function readUserPieceFile(file: Blob): Promise<UserPieceFileReadResult> {
  if (file.size === 0) {
    return { ok: false, message: 'Ce fichier est vide. Choisissez un autre fichier.' }
  }
  if (file.size > MAX_USER_PIECE_BYTES) {
    return {
      ok: false,
      message: `Ce fichier dépasse la limite de ${MAX_USER_PIECE_SIZE_LABEL}. `
        + 'Choisissez un fichier plus léger ou reprenez la photo.',
    }
  }
  let bytes: Uint8Array
  try {
    bytes = new Uint8Array(await file.arrayBuffer())
  } catch {
    return { ok: false, message: 'Ce fichier n’a pas pu être lu sur cet appareil.' }
  }
  const mediaType = detectUserPieceMediaType(bytes)
  return mediaType
    ? { ok: true, mediaType, bytes }
    : {
        ok: false,
        message: 'Ce format n’est pas pris en charge. Choisissez un PDF, une image JPEG, PNG ou WebP.',
      }
}
