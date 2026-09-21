import { Link } from 'react-router-dom';

export default function NotFound() {
  return (
    <div className="card">
      <h1>Page introuvable</h1>
      <p>
        <Link to="/">Retour à l'accueil</Link>
      </p>
    </div>
  );
}
