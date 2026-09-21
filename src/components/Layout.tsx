import { useEffect } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { dataset } from '../lib/dataset';
import { formatDate, REPO_URL } from '../lib/format';
import { useAppState } from '../state/AppState';

const nav = [
  { to: '/', label: 'Accueil', end: true },
  { to: '/questionnaire', label: 'Questionnaire' },
  { to: '/resultats', label: 'Résultats' },
  { to: '/candidats', label: 'Candidats' },
  { to: '/mises-a-jour', label: 'Mises à jour' },
  { to: '/methodologie', label: 'Méthode' },
  { to: '/confidentialite', label: 'Confidentialité' },
];

export default function Layout() {
  const { results } = useAppState();
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [pathname]);
  const sha = __COMMIT_SHA__.slice(0, 7);
  return (
    <div className="app">
      <a className="skip-link" href="#main">
        Aller au contenu
      </a>
      <header className="site-header">
        <div className="container header-inner">
          <NavLink to="/" className="brand" end>
            <span className="brand-mark" aria-hidden="true">
              ◎
            </span>
            <span>
              Boussole <strong>2027</strong>
            </span>
          </NavLink>
          <nav aria-label="Navigation principale">
            <ul>
              {nav.map((n) => (
                <li key={n.to}>
                  <NavLink to={n.to} end={n.end} className={({ isActive }) => (isActive ? 'active' : undefined)}>
                    {n.label}
                    {n.to === '/questionnaire' && results.answered > 0 && (
                      <span className="pill" aria-label={`${results.answered} réponses`}>
                        {results.answered}
                      </span>
                    )}
                  </NavLink>
                </li>
              ))}
            </ul>
          </nav>
        </div>
      </header>
      <main id="main" className="container">
        <Outlet />
      </main>
      <footer className="site-footer">
        <div className="container footer-grid">
          <div>
            <strong>Boussole présidentielle 2027</strong>
            <p>
              Outil libre, sans traceur ni cookie. Vos réponses ne quittent jamais votre appareil.{' '}
              <NavLink to="/transparence">Transparence</NavLink> · <NavLink to="/mentions-legales">Mentions légales</NavLink>
            </p>
          </div>
          <div className="footer-meta">
            <p>
              Jeu de données <code>{dataset.version}</code> généré le {formatDate(dataset.generatedAt.slice(0, 10))} ·{' '}
              {dataset.stats.positions} positions, dernière déclaration le {formatDate(dataset.stats.lastDeclarationDate)}.
            </p>
            <p>
              Code source :{' '}
              <a href={REPO_URL} rel="noopener noreferrer">
                dépôt public
              </a>{' '}
              (révision <code>{sha}</code>) · <a href={`${import.meta.env.BASE_URL}data/dataset.json`}>données brutes</a> ·{' '}
              <a href={`${import.meta.env.BASE_URL}data/updates.xml`}>flux RSS</a>
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
