import type { ReactNode } from 'react'
import type { Travel, TravelIllustration, TravelLink } from '../../domain/voyage/model'
import { safeExternalHttpsUrl } from '../../services/travelActions'
import { ExternalLinkIcon } from '../icons'
import { ExternalLink } from './ConsultationActions'
import { illustrationById, referencedIllustrations } from './consultationHelpers'
import { useLocalImageSource } from './consultationHooks'
import type { IllustrationResourceLoadResult } from './consultationTypes'

function LocalIllustration({
  travelId,
  illustration,
  loading,
  practicalLink,
  practicalLinkContext,
  online = true,
  onLoadResource,
}: {
  travelId: string
  illustration: TravelIllustration
  loading?: 'lazy'
  practicalLink?: TravelLink
  practicalLinkContext?: string
  online?: boolean
  onLoadResource(
    travelId: string,
    resourceId: string,
  ): Promise<IllustrationResourceLoadResult>
}) {
  const currentState = useLocalImageSource(
    travelId,
    illustration.resourceId,
    onLoadResource,
  )
  const practicalHref = practicalLink
    ? safeExternalHttpsUrl(practicalLink.href)
    : undefined

  if (currentState?.status === 'failed') {
    return (
      <figure className="travel-illustration illustration-fallback">
        <p role="status">Illustration locale indisponible : {illustration.alt}</p>
        {practicalLink && (
          <div className="illustration-fallback-action">
            <ExternalLink
              link={practicalLink}
              online={online}
              context={practicalLinkContext ?? illustration.alt}
            />
          </div>
        )}
        {illustration.caption && <figcaption>{illustration.caption}</figcaption>}
      </figure>
    )
  }

  return (
    <figure className="travel-illustration">
      {practicalHref && online ? (
        <a
          className="illustration-practical-link"
          href={practicalHref}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`${practicalLink!.label} pour ${practicalLinkContext ?? illustration.alt} — service externe, connexion requise`}
        >
          {currentState?.status === 'ready' ? (
            <img
              src={currentState.source}
              alt={illustration.alt}
              loading={loading}
            />
          ) : (
            <span className="illustration-loading" role="status">
              Chargement de l’illustration locale…
            </span>
          )}
          <span className="illustration-link-hint">
            {practicalLink!.label}
            <ExternalLinkIcon size={16} />
          </span>
        </a>
      ) : currentState?.status === 'ready' ? (
        <img
          src={currentState.source}
          alt={illustration.alt}
          loading={loading}
        />
      ) : (
        <div className="illustration-loading" role="status">
          Chargement de l’illustration locale…
        </div>
      )}
      {practicalHref && !online && (
        <span className="illustration-link-unavailable" role="status">
          {practicalLink!.label} · indisponible hors connexion
        </span>
      )}
      {illustration.caption && <figcaption>{illustration.caption}</figcaption>}
    </figure>
  )
}

export function IllustrationCollection({
  travel,
  illustrationIds,
  cover = false,
  limit,
  practicalLink,
  practicalLinkContext,
  online,
  onLoadResource,
}: {
  travel: Travel
  illustrationIds: readonly string[]
  cover?: boolean
  limit?: number
  practicalLink?: TravelLink
  practicalLinkContext?: string
  online?: boolean
  onLoadResource(
    travelId: string,
    resourceId: string,
  ): Promise<IllustrationResourceLoadResult>
}) {
  const illustrations = illustrationIds.flatMap((id) => {
    const illustration = illustrationById(travel, id)
    return illustration ? [illustration] : []
  }).slice(0, limit)
  if (illustrations.length === 0) return null

  return (
    <div className={cover ? 'illustration-grid cover-illustration' : 'illustration-grid'}>
      {illustrations.map((illustration, index) => (
        <LocalIllustration
          key={illustration.id}
          travelId={travel.id}
          illustration={illustration}
          loading={cover ? undefined : 'lazy'}
          practicalLink={index === 0 ? practicalLink : undefined}
          practicalLinkContext={practicalLinkContext}
          online={online}
          onLoadResource={onLoadResource}
        />
      ))}
    </div>
  )
}

function CreditExternalLink({
  href,
  children,
  online,
}: {
  href: string
  children: ReactNode
  online: boolean
}) {
  const safeHref = safeExternalHttpsUrl(href)
  return safeHref && online ? (
    <a href={safeHref} target="_blank" rel="noopener noreferrer">
      Service externe · {children}
    </a>
  ) : (
    <span aria-disabled="true">
      {safeHref
        ? `${String(children)} · indisponible hors connexion`
        : `${String(children)} · lien refusé`}
    </span>
  )
}

export function IllustrationCredits({
  travel,
  online,
}: {
  travel: Travel
  online: boolean
}) {
  const illustrations = referencedIllustrations(travel)
  if (illustrations.length === 0) return null

  return (
    <section className="illustration-credits" aria-labelledby="illustration-credits-title">
      <h3 id="illustration-credits-title">Crédits photographiques</h3>
      <ol>
        {illustrations.map((illustration) => {
          const provenance = illustration.provenance
          return (
            <li key={illustration.id}>
              <strong>{illustration.caption ?? illustration.alt}</strong>
              {provenance.type === 'licensed' && (
                <>
                  <span>Auteur : {provenance.creator}</span>
                  <span>
                    <CreditExternalLink href={provenance.sourceUrl} online={online}>
                      Source de l’image
                    </CreditExternalLink>
                    {' · '}
                    <CreditExternalLink href={provenance.licenseUrl} online={online}>
                      Licence {provenance.licenseCode}
                    </CreditExternalLink>
                  </span>
                  {provenance.modified && <span>Image recadrée ou transformée.</span>}
                </>
              )}
              {provenance.type === 'user-provided' && (
                <span>
                  Photographie personnelle
                  {provenance.credit ? ` · ${provenance.credit}` : ''}
                </span>
              )}
              {provenance.type === 'ai-generated' && (
                <span>
                  Image générée par IA · {provenance.provider}
                  {provenance.generatedAt ? ` · ${provenance.generatedAt}` : ''}
                </span>
              )}
            </li>
          )
        })}
      </ol>
    </section>
  )
}
