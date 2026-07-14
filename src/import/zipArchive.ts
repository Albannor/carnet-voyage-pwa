import { unzipSync } from 'fflate'
import { importIssue, type ImportIssue } from './errors'
import { IMPORT_LIMITS, type ImportLimits } from './limits'

const END_OF_CENTRAL_DIRECTORY_SIGNATURE = 0x06054b50
const CENTRAL_DIRECTORY_SIGNATURE = 0x02014b50
const LOCAL_FILE_HEADER_SIGNATURE = 0x04034b50
const MAX_ZIP_COMMENT_SIZE = 0xffff

export interface ArchiveEntryMetadata {
  readonly path: string
  readonly directory: boolean
  readonly compressedSize: number
  readonly uncompressedSize: number
  readonly crc32: number
}

export interface ReadArchiveSuccess {
  readonly ok: true
  readonly entries: readonly ArchiveEntryMetadata[]
  readonly files: ReadonlyMap<string, Uint8Array>
}

export interface ReadArchiveFailure {
  readonly ok: false
  readonly issue: ImportIssue
}

export type ReadArchiveResult = ReadArchiveSuccess | ReadArchiveFailure

interface CentralDirectoryLocation {
  entries: number
  offset: number
  size: number
  eocdOffset: number
}

interface ParsedEntry extends ArchiveEntryMetadata {
  flags: number
  compressionMethod: number
  localHeaderOffset: number
}

const crcTable = new Uint32Array(256)
for (let index = 0; index < 256; index += 1) {
  let value = index
  for (let bit = 0; bit < 8; bit += 1) {
    value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1
  }
  crcTable[index] = value >>> 0
}

function calculateCrc32(bytes: Uint8Array) {
  let crc = 0xffffffff
  for (const byte of bytes) {
    crc = crcTable[(crc ^ byte) & 0xff]! ^ (crc >>> 8)
  }
  return (crc ^ 0xffffffff) >>> 0
}

function archiveIssue(
  code: ImportIssue['code'],
  message: string,
  context: { file?: string; hint: string },
  kind: ImportIssue['kind'] = 'corrupt-archive',
): ReadArchiveFailure {
  return { ok: false, issue: importIssue(kind, code, message, context) }
}

function findCentralDirectory(
  bytes: Uint8Array,
): CentralDirectoryLocation | undefined {
  if (bytes.length < 22) {
    return undefined
  }

  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  const earliestOffset = Math.max(0, bytes.length - 22 - MAX_ZIP_COMMENT_SIZE)

  for (let offset = bytes.length - 22; offset >= earliestOffset; offset -= 1) {
    if (view.getUint32(offset, true) !== END_OF_CENTRAL_DIRECTORY_SIGNATURE) {
      continue
    }

    const commentLength = view.getUint16(offset + 20, true)
    if (offset + 22 + commentLength !== bytes.length) {
      continue
    }

    const diskNumber = view.getUint16(offset + 4, true)
    const centralDisk = view.getUint16(offset + 6, true)
    const entriesOnDisk = view.getUint16(offset + 8, true)
    const entries = view.getUint16(offset + 10, true)
    const size = view.getUint32(offset + 12, true)
    const centralOffset = view.getUint32(offset + 16, true)

    if (
      diskNumber !== 0 ||
      centralDisk !== 0 ||
      entriesOnDisk !== entries ||
      entries === 0xffff ||
      size === 0xffffffff ||
      centralOffset === 0xffffffff
    ) {
      return undefined
    }

    return { entries, offset: centralOffset, size, eocdOffset: offset }
  }

  return undefined
}

function decodeEntryPath(nameBytes: Uint8Array, utf8: boolean) {
  if (!utf8 && nameBytes.some((byte) => byte > 0x7f)) {
    return undefined
  }

  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(nameBytes)
  } catch {
    return undefined
  }
}

function pathIssue(path: string, limits: ImportLimits): ImportIssue | undefined {
  if (path.startsWith('/') || /^[A-Za-z]:/.test(path)) {
    return importIssue(
      'validation',
      'PATH_ABSOLUTE',
      `Le chemin « ${path} » est absolu.`,
      {
        file: path,
        hint: 'Utilisez uniquement des chemins relatifs à la racine du paquet.',
      },
    )
  }

  if (path.includes('\\')) {
    return importIssue(
      'validation',
      'PATH_INVALID_SEPARATOR',
      `Le chemin « ${path} » utilise un séparateur interdit.`,
      {
        file: path,
        hint: 'Utilisez uniquement le séparateur « / ».',
      },
    )
  }

  if (path.length > limits.maxPathLength) {
    return importIssue('limit', 'PATH_TOO_LONG', `Le chemin « ${path} » est trop long.`, {
      file: path,
      hint: `Limitez les chemins à ${limits.maxPathLength} caractères.`,
    })
  }

  const comparablePath = path.endsWith('/') ? path.slice(0, -1) : path
  const segments = comparablePath.split('/')

  if (segments.includes('..')) {
    return importIssue(
      'validation',
      'PATH_TRAVERSAL',
      `Le chemin « ${path} » tente de remonter dans l'arborescence.`,
      {
        file: path,
        hint: 'Supprimez tout segment « .. » du paquet.',
      },
    )
  }

  if (
    comparablePath.length === 0 ||
    segments.some(
      (segment) =>
        segment.length === 0 ||
        segment === '.' ||
        !/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(segment),
    ) ||
    path !== path.normalize('NFC')
  ) {
    return importIssue(
      'validation',
      'PATH_NOT_NORMALIZED',
      `Le chemin « ${path} » est ambigu ou mal normalisé.`,
      {
        file: path,
        hint: 'Utilisez des segments ASCII simples sans « . », segment vide ou caractère spécial.',
      },
    )
  }

  if (segments.length > limits.maxPathDepth) {
    return importIssue(
      'limit',
      'PATH_TOO_DEEP',
      `Le chemin « ${path} » dépasse la profondeur autorisée.`,
      {
        file: path,
        hint: `Limitez les chemins à ${limits.maxPathDepth} segments.`,
      },
    )
  }

  return undefined
}

function parseEntries(
  bytes: Uint8Array,
  location: CentralDirectoryLocation,
  limits: ImportLimits,
): { ok: true; entries: ParsedEntry[] } | ReadArchiveFailure {
  if (location.entries === 0) {
    return archiveIssue('ARCHIVE_EMPTY', "L'archive ZIP est vide.", {
      hint: 'Ajoutez au minimum manifest.json et voyage.json.',
    })
  }

  if (location.entries > limits.maxFileCount) {
    return archiveIssue(
      'FILE_COUNT_EXCEEDED',
      `L'archive contient ${location.entries} entrées, au-delà de la limite autorisée.`,
      { hint: `Limitez le paquet à ${limits.maxFileCount} entrées.` },
      'limit',
    )
  }

  if (
    location.offset + location.size > location.eocdOffset ||
    location.offset < 0
  ) {
    return archiveIssue('ARCHIVE_CORRUPTED', "Le répertoire central de l'archive est incohérent.", {
      hint: 'Recréez le fichier ZIP.',
    })
  }

  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  const entries: ParsedEntry[] = []
  const exactPaths = new Set<string>()
  const caseInsensitivePaths = new Map<string, string>()
  let cursor = location.offset
  let totalUncompressedSize = 0

  for (let index = 0; index < location.entries; index += 1) {
    if (
      cursor + 46 > bytes.length ||
      view.getUint32(cursor, true) !== CENTRAL_DIRECTORY_SIGNATURE
    ) {
      return archiveIssue('ARCHIVE_CORRUPTED', "Une entrée ZIP est tronquée ou illisible.", {
        hint: 'Recréez le fichier ZIP.',
      })
    }

    const flags = view.getUint16(cursor + 8, true)
    const compressionMethod = view.getUint16(cursor + 10, true)
    const crc32 = view.getUint32(cursor + 16, true)
    const compressedSize = view.getUint32(cursor + 20, true)
    const uncompressedSize = view.getUint32(cursor + 24, true)
    const nameLength = view.getUint16(cursor + 28, true)
    const extraLength = view.getUint16(cursor + 30, true)
    const commentLength = view.getUint16(cursor + 32, true)
    const diskStart = view.getUint16(cursor + 34, true)
    const localHeaderOffset = view.getUint32(cursor + 42, true)
    const entryEnd = cursor + 46 + nameLength + extraLength + commentLength

    if (
      entryEnd > location.offset + location.size ||
      diskStart !== 0 ||
      compressedSize === 0xffffffff ||
      uncompressedSize === 0xffffffff ||
      localHeaderOffset === 0xffffffff
    ) {
      return archiveIssue('ARCHIVE_UNSUPPORTED', "L'archive utilise une structure ZIP non prise en charge.", {
        hint: 'Créez une archive ZIP simple, non segmentée et sans ZIP64.',
      })
    }

    if ((flags & 1) !== 0) {
      return archiveIssue('ARCHIVE_ENCRYPTED', "Les archives ZIP chiffrées ne sont pas acceptées.", {
        hint: 'Recréez le paquet sans mot de passe ni chiffrement.',
      })
    }

    if (compressionMethod !== 0 && compressionMethod !== 8) {
      return archiveIssue('ARCHIVE_UNSUPPORTED', "Une méthode de compression ZIP n'est pas prise en charge.", {
        hint: 'Utilisez le stockage sans compression ou Deflate.',
      })
    }

    const nameBytes = bytes.subarray(cursor + 46, cursor + 46 + nameLength)
    const path = decodeEntryPath(nameBytes, (flags & 0x800) !== 0)
    if (!path) {
      return archiveIssue('PATH_NOT_NORMALIZED', "Un chemin ZIP n'utilise pas un encodage UTF-8 non ambigu.", {
        hint: 'Utilisez des noms de fichiers ASCII ou UTF-8 normalisés.',
      }, 'validation')
    }

    const invalidPath = pathIssue(path, limits)
    if (invalidPath) {
      return { ok: false, issue: invalidPath }
    }

    if (exactPaths.has(path)) {
      return archiveIssue('PATH_DUPLICATE', `Le chemin « ${path} » apparaît plusieurs fois dans l'archive.`, {
        file: path,
        hint: 'Conservez une seule entrée pour chaque chemin.',
      }, 'validation')
    }
    exactPaths.add(path)

    const comparablePath = path.toLowerCase()
    const collidingPath = caseInsensitivePaths.get(comparablePath)
    if (collidingPath && collidingPath !== path) {
      return archiveIssue(
        'PATH_CASE_COLLISION',
        `Les chemins « ${collidingPath} » et « ${path} » entrent en collision de casse.`,
        {
          file: path,
          hint: 'Utilisez des chemins distincts même sans tenir compte des majuscules.',
        },
        'validation',
      )
    }
    caseInsensitivePaths.set(comparablePath, path)

    if (uncompressedSize > limits.maxFileSize) {
      return archiveIssue(
        'FILE_SIZE_EXCEEDED',
        `Le fichier « ${path} » dépasse la taille maximale autorisée.`,
        { file: path, hint: `Limitez chaque fichier à ${limits.maxFileSize} octets.` },
        'limit',
      )
    }

    totalUncompressedSize += uncompressedSize
    if (totalUncompressedSize > limits.maxTotalUncompressedSize) {
      return archiveIssue(
        'TOTAL_SIZE_EXCEEDED',
        "La taille totale décompressée de l'archive dépasse la limite autorisée.",
        {
          file: path,
          hint: `Limitez le contenu décompressé à ${limits.maxTotalUncompressedSize} octets.`,
        },
        'limit',
      )
    }

    if (
      uncompressedSize >= limits.compressionRatioMinimumSize &&
      (compressedSize === 0 ||
        uncompressedSize / compressedSize > limits.maxCompressionRatio)
    ) {
      return archiveIssue(
        'COMPRESSION_RATIO_EXCEEDED',
        `Le fichier « ${path} » présente un ratio de compression dangereux.`,
        { file: path, hint: 'Réduisez le ratio de compression ou la taille du fichier.' },
        'limit',
      )
    }

    if (path === 'manifest.json' && uncompressedSize > limits.maxManifestSize) {
      return archiveIssue('MANIFEST_TOO_LARGE', 'manifest.json dépasse la taille autorisée.', {
        file: path,
        hint: `Limitez manifest.json à ${limits.maxManifestSize} octets.`,
      }, 'limit')
    }

    if (path === 'voyage.json' && uncompressedSize > limits.maxTravelSize) {
      return archiveIssue('TRAVEL_TOO_LARGE', 'voyage.json dépasse la taille autorisée.', {
        file: path,
        hint: `Limitez voyage.json à ${limits.maxTravelSize} octets.`,
      }, 'limit')
    }

    entries.push({
      path,
      directory: path.endsWith('/'),
      compressedSize,
      uncompressedSize,
      crc32,
      flags,
      compressionMethod,
      localHeaderOffset,
    })
    cursor = entryEnd
  }

  if (cursor !== location.offset + location.size) {
    return archiveIssue('ARCHIVE_CORRUPTED', "Le répertoire central de l'archive contient des données incohérentes.", {
      hint: 'Recréez le fichier ZIP.',
    })
  }

  return { ok: true, entries }
}

function validateLocalHeaders(
  bytes: Uint8Array,
  entries: readonly ParsedEntry[],
): ReadArchiveFailure | undefined {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)

  for (const entry of entries) {
    const offset = entry.localHeaderOffset
    if (
      offset + 30 > bytes.length ||
      view.getUint32(offset, true) !== LOCAL_FILE_HEADER_SIGNATURE
    ) {
      return archiveIssue('ARCHIVE_CORRUPTED', `L'en-tête local de « ${entry.path} » est introuvable.`, {
        file: entry.path,
        hint: 'Recréez le fichier ZIP.',
      })
    }

    const flags = view.getUint16(offset + 6, true)
    const method = view.getUint16(offset + 8, true)
    const nameLength = view.getUint16(offset + 26, true)
    const extraLength = view.getUint16(offset + 28, true)
    const nameStart = offset + 30
    const nameEnd = nameStart + nameLength

    if (nameEnd + extraLength > bytes.length) {
      return archiveIssue('ARCHIVE_CORRUPTED', `L'en-tête local de « ${entry.path} » est tronqué.`, {
        file: entry.path,
        hint: 'Recréez le fichier ZIP.',
      })
    }

    const localPath = decodeEntryPath(
      bytes.subarray(nameStart, nameEnd),
      (flags & 0x800) !== 0,
    )
    if (
      localPath !== entry.path ||
      flags !== entry.flags ||
      method !== entry.compressionMethod
    ) {
      return archiveIssue('ARCHIVE_CORRUPTED', `Les métadonnées de « ${entry.path} » sont contradictoires.`, {
        file: entry.path,
        hint: 'Recréez le fichier ZIP.',
      })
    }
  }

  return undefined
}

export function readZipArchive(
  bytes: Uint8Array,
  limits: ImportLimits = IMPORT_LIMITS,
): ReadArchiveResult {
  const location = findCentralDirectory(bytes)
  if (!location) {
    return archiveIssue('ARCHIVE_CORRUPTED', "Le fichier n'est pas une archive ZIP lisible.", {
      hint: 'Sélectionnez une archive ZIP valide et non segmentée.',
    })
  }

  const parsed = parseEntries(bytes, location, limits)
  if (!parsed.ok) {
    return parsed
  }

  const headerFailure = validateLocalHeaders(bytes, parsed.entries)
  if (headerFailure) {
    return headerFailure
  }

  let decompressed: Record<string, Uint8Array>
  try {
    decompressed = unzipSync(bytes)
  } catch {
    return archiveIssue('ARCHIVE_CORRUPTED', "L'archive ne peut pas être décompressée.", {
      hint: 'Recréez le fichier ZIP puis réessayez.',
    })
  }

  const files = new Map<string, Uint8Array>()
  for (const entry of parsed.entries) {
    if (entry.directory) {
      if (entry.uncompressedSize !== 0) {
        return archiveIssue('ARCHIVE_CORRUPTED', `Le dossier « ${entry.path} » contient des données inattendues.`, {
          file: entry.path,
          hint: 'Recréez le fichier ZIP.',
        })
      }
      continue
    }

    const content = decompressed[entry.path]
    if (
      !Object.hasOwn(decompressed, entry.path) ||
      !(content instanceof Uint8Array) ||
      content.length !== entry.uncompressedSize ||
      calculateCrc32(content) !== entry.crc32
    ) {
      return archiveIssue('ARCHIVE_CORRUPTED', `Le contenu de « ${entry.path} » est incohérent ou corrompu.`, {
        file: entry.path,
        hint: 'Recréez le fichier ZIP.',
      })
    }
    files.set(entry.path, content)
  }

  return { ok: true, entries: parsed.entries, files }
}
