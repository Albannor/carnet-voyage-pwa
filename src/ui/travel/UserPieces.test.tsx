import { useState } from 'react'
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { TEST_PDF_BYTES, TEST_PNG_BYTES } from '../../import/test/packageFixtures'
import type {
  NewUserPiece,
  PersistedUserPieceFile,
  UserPieceMetadata,
} from '../../persistence/model'
import type { RequestScreenWakeLock, ScreenWakeLockHandle } from '../../services/screenWakeLock'
import { TravelConsultation, type TravelView } from './TravelConsultation'
import {
  consultationTravel,
  fixedClock,
  persistedConsultationTravel,
} from './testFixtures'

beforeEach(() => {
  Object.defineProperty(URL, 'createObjectURL', {
    configurable: true,
    value: vi.fn((blob: Blob) => `blob:test-${blob.type}`),
  })
  Object.defineProperty(URL, 'revokeObjectURL', {
    configurable: true,
    value: vi.fn(),
  })
})

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

function addedPiece(overrides: Partial<UserPieceMetadata> = {}): UserPieceMetadata {
  return {
    travelId: consultationTravel.id,
    pieceId: 'added-qr',
    version: 1,
    title: 'QR code du ferry',
    kind: 'transport',
    attachment: { type: 'step', stepId: 'step-ferry' },
    mediaType: 'image/png',
    size: TEST_PNG_BYTES.length,
    createdAt: '2026-07-10T09:00:00.000Z',
    updatedAt: '2026-07-10T09:00:00.000Z',
    ...overrides,
  }
}

function UserPiecesHarness({
  initialView = { kind: 'pieces' },
  initialPieces = [],
  onAdd = vi.fn(),
  onRename = vi.fn().mockResolvedValue({ ok: true }),
  onDelete = vi.fn().mockResolvedValue({ ok: true }),
  onOpenUserPiece = vi.fn(),
  onLoadUserPieceFile = vi.fn().mockResolvedValue({
    ok: true,
    file: {
      travelId: consultationTravel.id,
      pieceId: 'added-qr',
      mediaType: 'image/png',
      bytes: TEST_PNG_BYTES,
    } satisfies PersistedUserPieceFile,
  }),
  requestWakeLock = vi.fn().mockResolvedValue(undefined),
}: {
  initialView?: TravelView
  initialPieces?: readonly UserPieceMetadata[]
  onAdd?: (piece: NewUserPiece) => void
  onRename?: (pieceId: string, title: string) => Promise<{ ok: true } | { ok: false; message: string }>
  onDelete?: (pieceId: string) => Promise<{ ok: true } | { ok: false; message: string }>
  onOpenUserPiece?: (piece: UserPieceMetadata) => void
  onLoadUserPieceFile?: (travelId: string, pieceId: string) => Promise<
    | { ok: true; file: PersistedUserPieceFile }
    | { ok: false; message: string }
  >
  requestWakeLock?: RequestScreenWakeLock
}) {
  const [view, setView] = useState<TravelView>(initialView)
  const [pieces, setPieces] = useState(initialPieces)
  return (
    <TravelConsultation
      persistedTravel={persistedConsultationTravel}
      view={view}
      clock={fixedClock('2026-07-15T10:00:00Z')}
      online
      personalState={{ checkedItemKeys: [], note: '' }}
      onNavigate={setView}
      onBackToLibrary={vi.fn()}
      onCopyAddress={vi.fn().mockResolvedValue(true)}
      onOpenDocument={vi.fn()}
      onLoadIllustrationResource={vi.fn().mockResolvedValue({ ok: false, message: '' })}
      onListLocalResourceIds={vi.fn().mockResolvedValue(['pdf-booking'])}
      onSetChecklistItemChecked={vi.fn().mockResolvedValue({ ok: true })}
      onSaveNote={vi.fn().mockResolvedValue({ ok: true })}
      userPieces={pieces}
      onAddUserPiece={async (piece) => {
        onAdd(piece)
        const saved = addedPiece({
          pieceId: 'added-new',
          title: piece.title.trim(),
          kind: piece.kind,
          attachment: piece.attachment,
          mediaType: piece.mediaType,
          size: piece.bytes.byteLength,
        })
        setPieces((current) => [...current, saved])
        return { ok: true, piece: saved }
      }}
      onRenameUserPiece={async (pieceId, title) => {
        const result = await onRename(pieceId, title)
        if (result.ok) {
          setPieces((current) => current.map((piece) => (
            piece.pieceId === pieceId ? { ...piece, title } : piece
          )))
        }
        return result
      }}
      onDeleteUserPiece={async (pieceId) => {
        const result = await onDelete(pieceId)
        if (result.ok) setPieces((current) => current.filter((piece) => piece.pieceId !== pieceId))
        return result
      }}
      onOpenUserPiece={onOpenUserPiece}
      onLoadUserPieceFile={onLoadUserPieceFile}
      requestWakeLock={requestWakeLock}
    />
  )
}

function chooseFile(input: HTMLElement, bytes: Uint8Array, name: string) {
  fireEvent.change(input, {
    target: { files: [new File([Uint8Array.from(bytes)], name)] },
  })
}

describe('pièces ajoutées dans les vues dérivées', () => {
  it('distingue l’origine « Ajoutée » de « Dossier » dans l’espace Pièces et la journée', () => {
    render(<UserPiecesHarness initialPieces={[addedPiece()]} />)

    const row = screen.getByRole('button', { name: /^Voir la fiche QR code du ferry/ })
    expect(row).toHaveAccessibleName(
      'Voir la fiche QR code du ferry — Étape 11:30 · Prendre le bateau — Image, Ajoutée',
    )
    expect(row.closest('.pieces-group')).toHaveAccessibleName('jeu. 16 juil. Cap sur l’île')
    expect(within(row).getByText('Ajoutée')).toHaveClass('piece-badge-added')
    expect(screen.getAllByText('Dossier').length).toBeGreaterThan(0)

    cleanup()
    render(
      <UserPiecesHarness
        initialView={{ kind: 'day', dayId: 'day-island' }}
        initialPieces={[addedPiece()]}
      />,
    )
    const strip = screen.getByRole('region', { name: 'Pièces du jour · 1' })
    expect(within(strip).getByRole('button', {
      name: 'Voir la fiche QR code du ferry — Étape 11:30 · Prendre le bateau — Image, Ajoutée',
    })).toBeVisible()
  })

  it('liste une pièce ajoutée parmi les pièces de son étape', () => {
    render(
      <UserPiecesHarness
        initialView={{ kind: 'step', stepId: 'step-ferry' }}
        initialPieces={[addedPiece()]}
      />,
    )

    const pieces = screen.getByRole('region', { name: 'Pièces de cette étape · 1' })
    expect(within(pieces).getByRole('button', {
      name: 'Voir la fiche QR code du ferry — Ajoutée sur cet appareil — Image, Ajoutée',
    })).toBeVisible()
  })
})

describe('ajout d’une pièce', () => {
  it('ouvre le formulaire depuis l’espace Pièces avec de vrais libellés', () => {
    render(<UserPiecesHarness />)

    fireEvent.click(screen.getByRole('button', { name: 'Ajouter une pièce' }))

    expect(screen.getByRole('heading', { level: 2, name: 'Ajouter une pièce' })).toBeVisible()
    expect(screen.getByLabelText('Titre')).toHaveAttribute('type', 'text')
    expect(screen.getByLabelText('Type').tagName).toBe('SELECT')
    expect(screen.getByLabelText('Rattacher à')).toHaveValue('travel')
    expect(screen.getByLabelText(/Prendre une photo/)).toHaveAttribute('capture', 'environment')
    expect(screen.getByLabelText(/Choisir un fichier/)).toHaveAttribute(
      'accept',
      'application/pdf,image/jpeg,image/png,image/webp',
    )
    expect(screen.getByText(
      'Cette pièce reste sur cet appareil, comme vos notes et vos checklists.',
    )).toBeVisible()
  })

  it('préremplit le rattachement depuis l’étape et y revient en annulant', () => {
    render(<UserPiecesHarness initialView={{ kind: 'step', stepId: 'step-ferry' }} />)

    fireEvent.click(screen.getByRole('button', { name: 'Ajouter une pièce à cette étape' }))
    expect(screen.getByLabelText('Rattacher à')).toHaveValue('step:step-ferry')

    fireEvent.click(screen.getByRole('button', { name: 'Annuler' }))
    expect(screen.getByRole('heading', { level: 2, name: 'Prendre le bateau' })).toBeVisible()
  })

  it('refuse un format non pris en charge et exige un fichier et un titre', async () => {
    const onAdd = vi.fn()
    render(<UserPiecesHarness initialView={{ kind: 'add-piece' }} onAdd={onAdd} />)

    fireEvent.click(screen.getByRole('button', { name: 'Enregistrer la pièce' }))
    expect(await screen.findByText(/Choisissez un fichier ou prenez une photo/)).toBeVisible()
    expect(screen.getByText('Donnez un titre à cette pièce.')).toBeVisible()
    expect(screen.getByLabelText('Titre')).toHaveAttribute('aria-invalid', 'true')

    chooseFile(screen.getByLabelText(/Choisir un fichier/), new TextEncoder().encode('<svg/>'), 'qr.png')
    expect(await screen.findByText(/Ce format n’est pas pris en charge/)).toBeVisible()
    expect(onAdd).not.toHaveBeenCalled()
  })

  it('enregistre une photo avec le titre, le type et le rattachement choisis', async () => {
    const onAdd = vi.fn()
    render(<UserPiecesHarness initialView={{ kind: 'add-piece' }} onAdd={onAdd} />)

    chooseFile(screen.getByLabelText(/Prendre une photo/), TEST_PNG_BYTES, 'IMG_0001.png')
    expect(await screen.findByText('Image · prêt à être enregistré')).toBeVisible()
    fireEvent.change(screen.getByLabelText('Titre'), { target: { value: 'QR du musée' } })
    fireEvent.change(screen.getByLabelText('Type'), { target: { value: 'activity' } })
    fireEvent.change(screen.getByLabelText('Rattacher à'), { target: { value: 'day:day-harbour' } })
    fireEvent.click(screen.getByRole('button', { name: 'Enregistrer la pièce' }))

    await waitFor(() => expect(onAdd).toHaveBeenCalledWith({
      title: 'QR du musée',
      kind: 'activity',
      attachment: { type: 'day', dayId: 'day-harbour' },
      mediaType: 'image/png',
      bytes: TEST_PNG_BYTES,
    }))
    expect(await screen.findByRole('heading', { level: 2, name: 'QR du musée' })).toBeVisible()
  })
})

describe('fiche d’une pièce ajoutée', () => {
  const pdfView: TravelView = { kind: 'piece', pieceKind: 'added', pieceId: 'added-pdf' }
  const pdfPiece = addedPiece({
    pieceId: 'added-pdf',
    title: 'Billet ferry',
    mediaType: 'application/pdf',
    size: TEST_PDF_BYTES.length,
  })

  it('ouvre un PDF ajouté et affiche son origine et son type', () => {
    const onOpenUserPiece = vi.fn()
    render(
      <UserPiecesHarness
        initialView={pdfView}
        initialPieces={[pdfPiece]}
        onOpenUserPiece={onOpenUserPiece}
      />,
    )

    expect(screen.getByText(/^Ajoutée sur cet appareil le 10 juillet 2026$/)).toBeVisible()
    expect(screen.getByText('Transport')).toBeVisible()
    expect(screen.getByText(/^Pièce ajoutée : elle reste sur cet appareil/)).toBeVisible()
    fireEvent.click(screen.getByRole('button', { name: 'Ouvrir le PDF Billet ferry' }))
    expect(onOpenUserPiece).toHaveBeenCalledWith(pdfPiece)
  })

  it('renomme une pièce ajoutée', async () => {
    const onRename = vi.fn().mockResolvedValue({ ok: true })
    render(<UserPiecesHarness initialView={pdfView} initialPieces={[pdfPiece]} onRename={onRename} />)

    fireEvent.click(screen.getByRole('button', { name: 'Renommer' }))
    const field = screen.getByLabelText('Nouveau titre')
    expect(field).toHaveValue('Billet ferry')
    fireEvent.change(field, { target: { value: 'Billet aller' } })
    fireEvent.click(screen.getByRole('button', { name: 'Enregistrer le titre' }))

    await waitFor(() => expect(onRename).toHaveBeenCalledWith('added-pdf', 'Billet aller'))
    expect(await screen.findByRole('heading', { level: 2, name: 'Billet aller' })).toBeVisible()
  })

  it('ne supprime qu’après une confirmation explicite', async () => {
    const onDelete = vi.fn().mockResolvedValue({ ok: true })
    render(<UserPiecesHarness initialView={pdfView} initialPieces={[pdfPiece]} onDelete={onDelete} />)

    fireEvent.click(screen.getByRole('button', { name: 'Supprimer' }))
    const confirmation = screen.getByRole('group', { name: 'Supprimer « Billet ferry » ?' })
    expect(confirmation).toHaveFocus()
    expect(confirmation).toHaveTextContent(/définitive/)
    fireEvent.click(within(confirmation).getByRole('button', { name: 'Annuler' }))
    expect(onDelete).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole('button', { name: 'Supprimer' }))
    fireEvent.click(screen.getByRole('button', { name: 'Supprimer définitivement' }))

    await waitFor(() => expect(onDelete).toHaveBeenCalledWith('added-pdf'))
    expect(await screen.findByRole('heading', { level: 2, name: 'Pièces du voyage' })).toBeVisible()
    expect(screen.queryByText('Billet ferry')).not.toBeInTheDocument()
  })
})

describe('mode présentation', () => {
  const imageView: TravelView = { kind: 'piece', pieceKind: 'added', pieceId: 'added-qr' }

  function wakeLockHandle() {
    const listeners: Array<() => void> = []
    const handle: ScreenWakeLockHandle & { fireRelease(): void } = {
      released: false,
      release: vi.fn().mockResolvedValue(undefined),
      addEventListener: (_type, listener) => listeners.push(listener),
      fireRelease: () => listeners.forEach((listener) => listener()),
    }
    return handle
  }

  it('affiche l’aperçu local puis présente l’image en plein écran', async () => {
    render(<UserPiecesHarness initialView={imageView} initialPieces={[addedPiece()]} />)

    expect(await screen.findByRole('img', { name: 'QR code du ferry' }))
      .toHaveAttribute('src', 'blob:test-image/png')
    fireEvent.click(screen.getByRole('button', { name: 'Présenter QR code du ferry en plein écran' }))

    const dialog = screen.getByRole('dialog', { name: 'QR code du ferry' })
    expect(dialog).toHaveAttribute('aria-modal', 'true')
    const close = within(dialog).getByRole('button', { name: 'Fermer' })
    expect(close).toHaveFocus()
    expect(within(dialog).queryByText(/Écran maintenu allumé/)).not.toBeInTheDocument()

    fireEvent.click(close)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('n’annonce l’écran maintenu allumé que si le verrou est obtenu, puis le libère', async () => {
    const handle = wakeLockHandle()
    const requestWakeLock = vi.fn().mockResolvedValue(handle)
    render(
      <UserPiecesHarness
        initialView={imageView}
        initialPieces={[addedPiece()]}
        requestWakeLock={requestWakeLock}
      />,
    )
    fireEvent.click(await screen.findByRole('button', { name: /^Présenter/ }))

    const dialog = screen.getByRole('dialog')
    expect(await within(dialog).findByText(/Écran maintenu allumé/)).toBeVisible()

    act(() => handle.fireRelease())
    expect(within(dialog).queryByText(/Écran maintenu allumé/)).not.toBeInTheDocument()

    fireEvent.keyDown(dialog, { key: 'Escape' })
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(handle.release).toHaveBeenCalled()
  })

  it('révoque l’URL d’objet de l’image en quittant la fiche', async () => {
    const { unmount } = render(
      <UserPiecesHarness initialView={imageView} initialPieces={[addedPiece()]} />,
    )
    await screen.findByRole('img', { name: 'QR code du ferry' })

    unmount()

    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:test-image/png')
  })
})
