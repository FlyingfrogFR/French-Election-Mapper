import { Link } from 'react-router-dom';
import { dataset } from '../lib/dataset';
import { daysSince, formatDate } from '../lib/format';

export default function FreshnessBanner() {
  const age = daysSince(dataset.stats.lastDeclarationDate);
  const stale = age === null || age > 7;
  return (
    <p className={`notice ${stale ? 'warn' : 'ok'}`}>
      {age === null
        ? 'Aucune déclaration enregistrée.'
        : `Dernière déclaration enregistrée le ${formatDate(dataset.stats.lastDeclarationDate)} (il y a ${age} jour${age > 1 ? 's' : ''}).`}{' '}
      {dataset.stats.pending > 0 && (
        <>
          {dataset.stats.pending} position{dataset.stats.pending > 1 ? 's' : ''} sur {dataset.stats.positions} en attente de vérification par un second relecteur.{' '}
        </>
      )}
      <Link to="/mises-a-jour">Voir le journal des mises à jour</Link>.
    </p>
  );
}
