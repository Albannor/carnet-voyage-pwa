import { describe, expect, it } from 'vitest'
import {
  TEST_JPEG_BYTES,
  TEST_PDF_BYTES,
  TEST_PNG_BYTES,
  TEST_WEBP_BYTES,
} from '../import/test/packageFixtures'
import { MAX_USER_PIECE_BYTES, detectUserPieceMediaType } from '../persistence/model'
import { readUserPieceFile } from './userPieces'

describe('lecture d’une pièce ajoutée', () => {
  it.each([
    [TEST_PDF_BYTES, 'application/pdf'],
    [TEST_JPEG_BYTES, 'image/jpeg'],
    [TEST_PNG_BYTES, 'image/png'],
    [TEST_WEBP_BYTES, 'image/webp'],
  ] as const)('reconnaît le format par sa signature (%#)', (bytes, mediaType) => {
    expect(detectUserPieceMediaType(bytes)).toBe(mediaType)
  })

  it('ignore le nom et le type annoncés par le navigateur', async () => {
    const file = new File([Uint8Array.from(TEST_PNG_BYTES)], 'billet.pdf', {
      type: 'application/pdf',
    })

    expect(await readUserPieceFile(file)).toMatchObject({ ok: true, mediaType: 'image/png' })
  })

  it('refuse un format non pris en charge avec un message explicite', async () => {
    const file = new File(['<svg xmlns="http://www.w3.org/2000/svg"/>'], 'qr.png', {
      type: 'image/png',
    })

    expect(await readUserPieceFile(file)).toEqual({
      ok: false,
      message: 'Ce format n’est pas pris en charge. Choisissez un PDF, une image JPEG, PNG ou WebP.',
    })
  })

  it('refuse un fichier vide ou trop lourd avant de le lire', async () => {
    expect(await readUserPieceFile(new File([], 'vide.pdf'))).toMatchObject({
      ok: false,
      message: expect.stringMatching(/vide/),
    })

    const heavy = new Blob([new Uint8Array(MAX_USER_PIECE_BYTES + 1)])
    expect(await readUserPieceFile(heavy)).toMatchObject({
      ok: false,
      message: expect.stringMatching(/dépasse la limite de 10 Mo/),
    })
  })
})
