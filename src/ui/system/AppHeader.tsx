const logoSource = `${import.meta.env.BASE_URL}icons/carnet.svg`

/**
 * En-tête de la bibliothèque. L’état hors connexion et les mises à jour sont
 * annoncés une seule fois, par le panneau d’état ; l’import passe par le
 * sélecteur de fichier de la bibliothèque.
 */
export function AppHeader() {
  return (
    <header className="app-header">
      <div className="app-header-bar">
        <div className="brand">
          <img className="brand-logo" src={logoSource} alt="" width={36} height={36} />
          <h1 className="brand-name">Carnet de voyage</h1>
        </div>
      </div>
    </header>
  )
}
