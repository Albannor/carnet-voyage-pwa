const principles = [
  {
    title: 'Local',
    description: 'Les voyages resteront enregistrés sur votre appareil.',
  },
  {
    title: 'Disponible',
    description: 'Les informations essentielles seront consultables hors ligne.',
  },
  {
    title: 'Cohérent',
    description: 'Chaque voyage bénéficiera de la même interface claire et familière.',
  },
]

export function App() {
  return (
    <div className="app-shell">
      <a className="skip-link" href="#contenu-principal">
        Aller au contenu
      </a>

      <header className="hero">
        <div className="brand-mark" aria-hidden="true">
          CV
        </div>
        <p className="eyebrow">Votre bibliothèque personnelle</p>
        <h1>Carnet de voyage</h1>
        <p className="intro">
          L’application permettra de conserver vos voyages sur cet appareil et de
          consulter leurs informations essentielles hors ligne.
        </p>
      </header>

      <main id="contenu-principal" tabIndex={-1}>
        <section className="foundation" aria-labelledby="foundation-title">
          <p className="section-label">Socle applicatif</p>
          <h2 id="foundation-title">Votre carnet prend forme</h2>
          <p className="foundation-copy">
            Cette première version installe une base fiable, accessible et pensée
            pour le mobile. La bibliothèque et l’import seront ajoutés dans les
            prochaines étapes.
          </p>

          <ul className="principles" aria-label="Principes du carnet">
            {principles.map((principle) => (
              <li key={principle.title}>
                <strong>{principle.title}</strong>
                <span>{principle.description}</span>
              </li>
            ))}
          </ul>
        </section>
      </main>

      <footer>
        <p>Aucun compte requis. Vos voyages resteront sous votre contrôle.</p>
      </footer>
    </div>
  )
}
