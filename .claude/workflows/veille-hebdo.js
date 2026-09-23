export const meta = {
  name: 'veille-hebdo',
  description: 'Veille hebdomadaire : déclarations officielles des candidat·es, encodées avec citation et relues par deux vérificateurs adverses',
  whenToUse: "Mise à jour hebdomadaire des positions de la Boussole présidentielle 2027 (voir docs/MISES-A-JOUR.md, section « Veille automatisée »)",
  phases: [
    { title: 'Statuts', detail: 'candidatures nouvelles ou retirées, primaires, désignations' },
    { title: 'Recherche', detail: 'une recherche par candidat·e, dans ses seules publications officielles' },
    { title: 'Vérification', detail: 'deux relectures adverses par proposition : fidélité et provenance' },
    { title: 'Complétude', detail: 'ce que la recherche a pu manquer, puis recherche et relecture ciblées' },
  ],
}

// Procedure for the automated weekly research. This file is public on purpose: it is exactly what the
// research agents are told, so anyone can check that nothing in their instructions favours a candidate.
//
// Agents only PROPOSE. Nothing here writes to data/: the result is applied by a separate, deterministic
// step, checked by `npm run check` and `npm run data:check-quotes`, and published only when a human merges
// the pull request. Every position stays `pending` until a second person reviews it (docs/CHARTE-EDITORIALE.md).
//
// args: {
//   today: 'AAAA-MM-JJ', since: 'AAAA-MM-JJ',           // research window (inclusive)
//   repo?: '/home/user/French-Election-Mapper',
//   candidates: [{ id, name, status, positions, lastUpdated, since? }],   // `npm run -s data:freshness -- --json` → .candidates
//   statusSweep?: true, critic?: true,
// }

const A = args || {}
const REPO = A.repo || '/home/user/French-Election-Mapper'
const TODAY = A.today
const SINCE = A.since
const CANDIDATES = A.candidates || []
if (!TODAY || !SINCE || !CANDIDATES.length) throw new Error('args.today, args.since et args.candidates sont requis')

const RULES = `Tu contribues à la Boussole présidentielle 2027, boussole électorale open source dont la promesse publique est « aucune déformation » des positions des candidat·es. Dépôt : ${REPO} (lance toutes les commandes depuis ce répertoire). La charte éditoriale fait foi : lis d'abord la section « Positions des candidat·es » de docs/CHARTE-EDITORIALE.md.

RÈGLES NON NÉGOCIABLES
1. Source officielle uniquement. Une position ne peut venir que d'un document publié par le ou la candidat·e, ou par son parti quand la personne en est la candidate désignée et ne s'en est pas démarquée : programme, projet, livret, page de propositions du site de campagne, discours / communiqué / tribune publiés sur un canal officiel, tribune signée par la personne, vote enregistré (assemblee-nationale.fr, senat.fr, europarl.europa.eu) ou proposition de loi qu'elle a déposée, profession de foi officielle. Une copie web.archive.org d'un document officiel est acceptable.
   INTERDIT pour fonder une position : article de presse (entretien de presse compris), dépêche, comparateur ou agrégateur (elyseescope, monvote2027, votons-2027, france-vote, programme-candidat, Wikipédia…), message de réseau social sans texte vérifiable, vidéo sans transcription officielle. Ces sources servent seulement à LOCALISER un document officiel.
   La personne, pas le parti : la déclaration d'un·e porte-parole ou d'un·e autre dirigeant·e ne fonde pas une position du ou de la candidat·e.
2. Encodage sur l'affirmation telle qu'elle est écrite (échelle −2..+2) : ±2 la mesure est explicitement proposée ou rejetée ; ±1 orientation, mesure plus faible, partielle ou conditionnelle (le dire dans note) ; 0 position mitigée assumée. Si le document traite d'une mesure voisine et que la position s'en déduit sans ambiguïté : inferred = true et note explicative. Jamais de déduction depuis l'idéologie, la famille politique ou le bilan. Le doute se résout par l'absence de position.
3. Citation verbatim. Chaque position porte un extrait exact (300 caractères au plus) du document, copié depuis la sortie de \`npm run -s data:source -- <url>\` : c'est le lecteur qu'utilise le contrôle automatique des citations. Avant de proposer une position, lance \`npm run -s data:source -- <url> --quote="<citation>"\` : seule la réponse « exact » est acceptée (« fuzzy » toléré pour un PDF aux coupures de ligne). Une citation inventée, paraphrasée ou recomposée est la pire faute possible ; une position manquante est acceptable.
4. La déclaration la plus récente l'emporte sur chaque affirmation qu'elle encode. N'encode donc une affirmation déjà couverte que si le nouveau document y prend position de façon au moins aussi précise que la source actuelle : un texte plus vague ne remplace pas un programme précis. Un changement de valeur doit refléter un vrai changement de position, et la note le dit (« Remplace +2 du programme de 2022 : … »).
5. Date = date de publication du document (sur la page, dans le PDF ou dans l'URL). Page non datée : date de consultation, et le dire dans summary.
6. Ne modifie AUCUN fichier du dépôt. Tu proposes ; d'autres vérifient ; l'intégration est faite à part. Tes fichiers de travail vont sous /tmp.
7. Neutralité : le même soin pour chaque candidat·e. Titre, résumé et notes décrivent, sans qualifier ni commenter.

OUTILS
- \`npm run -s data:brief -- <id>\` : statut, site officiel connu, déclarations déjà enregistrées (à ne jamais rajouter), et les 163 affirmations avec la position actuelle de la personne.
- \`npm run -s data:source -- <url>\` : texte intégral d'une page ou d'un PDF tel que le contrôle le lira (pages protégées : navigateur headless automatique). Options : --grep="mots" (passages autour de chaque occurrence), --links (liens de la page), --quote="…" (contrôle d'une citation), --out=/tmp/fichier.txt.
- WebSearch pour trouver les publications (charger avec ToolSearch "select:WebSearch,WebFetch") ; WebFetch pour survoler une page, jamais pour copier une citation (il résume).`

const SOURCE_TYPES = ['programme', 'discours', 'tribune', 'communique', 'vote', 'interview', 'autre']

const POSITION = {
  type: 'object',
  properties: {
    questionId: { type: 'string', description: 'identifiant xxx-NN existant' },
    value: { type: 'integer', enum: [-2, -1, 0, 1, 2] },
    quote: { type: 'string', description: 'extrait verbatim, 300 caractères au plus' },
    sourceUrl: { type: 'string', description: "URL exacte où se trouve la citation, si elle diffère de celle de la déclaration ; sinon chaîne vide" },
    page: { type: 'string', description: 'page du PDF, sinon chaîne vide' },
    inferred: { type: 'boolean' },
    note: { type: 'string', description: 'une phrase ; obligatoire pour ±1, 0, une déduction ou un changement de valeur' },
    previousValue: { type: ['integer', 'null'], description: 'valeur actuelle selon data:brief, null si aucune' },
    quoteCheck: { type: 'string', enum: ['exact', 'fuzzy'] },
  },
  required: ['questionId', 'value', 'quote', 'sourceUrl', 'page', 'inferred', 'note', 'previousValue', 'quoteCheck'],
}

const DECLARATION = {
  type: 'object',
  properties: {
    id: { type: 'string', description: '<candidat>-AAAA-MM-<mot-clé>, minuscules, chiffres et tirets' },
    date: { type: 'string', description: 'AAAA-MM-JJ' },
    title: { type: 'string' },
    sourceType: { type: 'string', enum: SOURCE_TYPES },
    sourceUrl: { type: 'string' },
    publisher: { type: 'string' },
    summary: { type: 'string', description: 'une ou deux phrases fidèles, sans commentaire' },
    positions: { type: 'array', items: POSITION },
  },
  required: ['id', 'date', 'title', 'sourceType', 'sourceUrl', 'publisher', 'summary', 'positions'],
}

const RESEARCH = {
  type: 'object',
  properties: {
    candidateId: { type: 'string' },
    declarations: { type: 'array', items: DECLARATION },
    officialWebsite: { type: 'string', description: 'site officiel de campagne ou de la personne, confirmé ; chaîne vide si inconnu' },
    searched: { type: 'string', description: 'ce qui a été consulté (sites, requêtes, documents lus), même si rien n’a été retenu' },
    statusNews: { type: 'string', description: 'fait nouveau sur la candidature avec URL, sinon chaîne vide' },
    problems: { type: 'array', items: { type: 'string' } },
  },
  required: ['candidateId', 'declarations', 'officialWebsite', 'searched', 'statusNews', 'problems'],
}

const VERDICTS = {
  type: 'object',
  properties: {
    declarations: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          declarationId: { type: 'string' },
          verdict: { type: 'string', enum: ['accept', 'reject'] },
          reason: { type: 'string' },
          corrections: {
            type: 'object',
            description: 'corrections mineures à appliquer si accept ; champs absents = inchangés',
            properties: {
              date: { type: 'string' },
              title: { type: 'string' },
              publisher: { type: 'string' },
              sourceType: { type: 'string', enum: SOURCE_TYPES },
              summary: { type: 'string' },
            },
          },
        },
        required: ['declarationId', 'verdict', 'reason'],
      },
    },
    positions: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          declarationId: { type: 'string' },
          questionId: { type: 'string' },
          verdict: { type: 'string', enum: ['accept', 'adjust', 'reject'] },
          adjustedValue: { type: 'integer', enum: [-2, -1, 0, 1, 2] },
          shouldBeInferred: { type: 'boolean' },
          reason: { type: 'string' },
        },
        required: ['declarationId', 'questionId', 'verdict', 'reason'],
      },
    },
    websiteVerdict: { type: 'string', enum: ['accept', 'reject', 'none'] },
  },
  required: ['declarations', 'positions', 'websiteVerdict'],
}

function windowFor(c) {
  return c.since || SINCE
}

function researchPrompt(c, hint) {
  const since = windowFor(c)
  const head = `${RULES}

CANDIDAT·E : ${c.name} (identifiant « ${c.id} »), statut « ${c.status} », ${c.positions} positions documentées, dernière déclaration enregistrée : ${c.lastUpdated || 'aucune'}.`
  if (hint) {
    return `${head}

MISSION CIBLÉE. Une relecture de complétude signale ces publications possiblement officielles, absentes du jeu de données :
${hint.map((h) => `- ${h.date || 'date ?'} · ${h.title} · ${h.url}\n  (${h.why})`).join('\n')}
Pour chacune : établis si c'est bien un document officiel au sens des règles, publié dans la période du ${since} au ${TODAY}, non déjà enregistré (data:brief). Si oui, lis-le en entier et encode-le selon les règles. Sinon, écarte-le et dis pourquoi dans problems.`
  }
  if (!c.positions) {
    return `${head}

MISSION : PREMIER ENCODAGE. Aucune position n'est encore documentée pour cette personne. Établis s'il existe des documents officiels (programme ou projet de campagne 2027, plateforme, pages de propositions, discours ou tribunes publiés par la personne, propositions de loi qu'elle a déposées, votes solennels sur les mesures exactes des affirmations) et encode ce qu'ils disent sur les 163 affirmations.
- Période : de préférence depuis le 2024-06-01. À défaut, le dernier programme officiel d'une élection où la personne était candidate ou tête de liste, s'il date de 2022 ou après, en le signalant au début de summary (« DOCUMENT DE 2024 »). Rien d'antérieur à 2022. Jamais un livre.
- Candidature pressentie ou candidate d'une primaire : seuls ses propres documents comptent ; le programme d'un parti n'est le sien que si elle en est la candidate désignée, ou si elle l'a signé ou présenté comme tête de liste.
- Couvre les 15 thèmes méthodiquement (data:brief les liste) : un document long est normal.
- Si aucun document officiel exploitable n'existe, c'est une réponse valable : declarations vide, et searched décrit précisément ce qui a été vérifié.
Identifiant de déclaration : « ${c.id}-AAAA-MM-<mot-clé> », unique. Types permis : ${SOURCE_TYPES.join(', ')} (interview seulement si la transcription intégrale est publiée par la personne ou son parti ; jamais « presse »).`
  }
  return `${head}

MISSION : VEILLE. Trouve les documents officiels publiés du ${since} au ${TODAY} inclus qui prennent position sur une ou plusieurs des 163 affirmations, et encode-les.
1. \`npm run -s data:brief -- ${c.id}\`.
2. Cherche sur la période : site de campagne et site du parti (actualités, communiqués, propositions, nouveau programme ou nouvelle version), discours publiés, tribunes signées, propositions de loi déposées et votes solennels si la personne est parlementaire (sur les mesures exactes des affirmations seulement), profession de foi. La presse sert uniquement à repérer ce qui a été publié (requêtes du type « ${c.name} propose », « ${c.name} programme », « ${c.name} discours », avec les mois de la période) ; remonte ensuite au document officiel.
3. Pour chaque document officiel de la période non déjà enregistré : lis-le en entier avec data:source, repère toutes les affirmations sur lesquelles il prend position, encode selon les règles, contrôle chaque citation avec --quote.
4. Rien d'officiel sur la période, ou rien qui touche les 163 affirmations : c'est une réponse valable ; décris dans searched ce que tu as vérifié.
Signale dans statusNews tout fait nouveau sur la candidature (déclaration officielle, retrait, désignation, primaire) avec son URL.
Identifiant de déclaration : « ${c.id}-AAAA-MM-<mot-clé> », unique (différent de ceux listés par data:brief). Types permis : ${SOURCE_TYPES.join(', ')} (interview seulement si la transcription intégrale est publiée par la personne ou son parti ; jamais « presse »).`
}

function proposalBlock(c, proposal) {
  return JSON.stringify(
    { candidateId: c.id, officialWebsite: proposal.officialWebsite, declarations: proposal.declarations },
    null,
    1,
  )
}

function fidelityPrompt(c, proposal) {
  return `${RULES}

RELECTURE ADVERSE — FIDÉLITÉ. Un·e chercheur·se propose d'ajouter les déclarations et positions ci-dessous pour ${c.name} (« ${c.id} »). Ton rôle est d'empêcher toute déformation : dans le doute, rejette.
Pour CHAQUE position :
- lis l'affirmation exacte et la position actuelle (\`npm run -s data:brief -- ${c.id}\`) ;
- lis la citation dans son contexte (\`npm run -s data:source -- <url> --grep="<premiers mots de la citation>"\`) ;
- juge : la citation exprime-t-elle la position de la personne elle-même (pas la description d'un adversaire, pas une hypothèse, pas une question, pas le bilan d'un autre) ? Porte-t-elle sur la mesure de l'affirmation et pas sur une mesure voisine (sinon la déduction doit être sans ambiguïté et marquée inferred) ? Le signe est-il juste ? La force (±2 explicite / ±1 orientation, partiel, conditionnel / 0 mitigé) ? Si la valeur actuelle est différente : le document exprime-t-il vraiment un changement, et est-il au moins aussi précis que la source actuelle ?
Verdict par position : accept | adjust (même signe, force moindre : adjustedValue) | reject (raison précise). shouldBeInferred = true si c'est une déduction non marquée comme telle.
Renseigne declarations (accept/reject sur la neutralité du titre et du résumé, avec corrections éventuelles) et websiteVerdict = none.

PROPOSITION :
${proposalBlock(c, proposal)}`
}

function provenancePrompt(c, proposal) {
  return `${RULES}

RELECTURE ADVERSE — PROVENANCE. Un·e chercheur·se propose d'ajouter les déclarations et positions ci-dessous pour ${c.name} (« ${c.id} »). Ton rôle : vérifier que chaque source est ce qu'elle prétend être. Dans le doute, rejette.
Pour CHAQUE déclaration : ouvre la source. Est-ce un document officiel au sens de la règle 1 (publié par la personne, ou par son parti dont elle est la candidate désignée ; ni presse, ni comparateur, ni autre responsable du parti) ? La date est-elle bien la date de publication, dans la période du ${windowFor(c)} au ${TODAY} (ou, pour un premier encodage, 2022 ou après) ? Le titre, l'éditeur (publisher), le type (sourceType) et le résumé sont-ils exacts et neutres ? N'est-elle pas déjà enregistrée (\`npm run -s data:brief -- ${c.id}\`) ? Verdict accept | reject, avec des corrections mineures si besoin.
Pour CHAQUE position : relance \`npm run -s data:source -- <url> --quote="<citation>"\` (url = sourceUrl de la position, sinon celle de la déclaration). « exact », ou « fuzzy » pour un PDF : accept ; sinon reject. Pour un vote : le nom de la personne figure-t-il dans la bonne liste (pour / contre) du scrutin cité ? Tu ne juges pas ici l'interprétation, seulement la provenance et l'exactitude de la citation.
websiteVerdict : accept si officialWebsite est bien le site officiel de la personne ou de sa campagne, reject sinon, none s'il est vide.

PROPOSITION :
${proposalBlock(c, proposal)}`
}

const sameSign = (a, b) => (a > 0 && b > 0) || (a < 0 && b < 0)

/** Deterministic merge of the two reviews: a position survives only if both reviewers let it through. */
function decide(c, proposal, fid, prov) {
  const accepted = []
  const rejected = []
  const find = (list, d, q) => (list || []).find((v) => v.declarationId === d && v.questionId === q)
  for (const d of proposal.declarations || []) {
    const dv = ((prov && prov.declarations) || []).find((v) => v.declarationId === d.id)
    const df = ((fid && fid.declarations) || []).find((v) => v.declarationId === d.id)
    if (!dv || dv.verdict !== 'accept') {
      rejected.push({ declarationId: d.id, questionId: null, reason: `provenance : ${dv ? dv.reason : 'non relue'}` })
      continue
    }
    if (df && df.verdict === 'reject') {
      rejected.push({ declarationId: d.id, questionId: null, reason: `fidélité : ${df.reason}` })
      continue
    }
    const corr = Object.assign({}, (df && df.corrections) || {}, dv.corrections || {})
    const decl = Object.assign({}, d, corr, { positions: [] })
    if (!/^\d{4}-\d{2}-\d{2}$/.test(decl.date)) decl.date = d.date
    if (!SOURCE_TYPES.includes(decl.sourceType)) decl.sourceType = d.sourceType
    for (const p of d.positions || []) {
      const pv = find(prov && prov.positions, d.id, p.questionId)
      const fv = find(fid && fid.positions, d.id, p.questionId)
      if (!pv || pv.verdict !== 'accept') {
        rejected.push({ declarationId: d.id, questionId: p.questionId, reason: `provenance : ${pv ? pv.reason : 'non relue'}` })
        continue
      }
      if (!fv) {
        rejected.push({ declarationId: d.id, questionId: p.questionId, reason: 'fidélité : non relue' })
        continue
      }
      let value = p.value
      let note = p.note
      if (fv.verdict === 'adjust') {
        const adj = fv.adjustedValue
        if (typeof adj !== 'number' || !sameSign(adj, p.value) || Math.abs(adj) >= Math.abs(p.value)) {
          rejected.push({ declarationId: d.id, questionId: p.questionId, reason: `fidélité : ajustement non conservateur (${p.value} → ${adj}) : ${fv.reason}` })
          continue
        }
        value = adj
        note = `${note ? `${note} ` : ''}(Force ramenée de ${p.value} à ${adj} en relecture : ${fv.reason})`
      } else if (fv.verdict !== 'accept') {
        rejected.push({ declarationId: d.id, questionId: p.questionId, reason: `fidélité : ${fv.reason}` })
        continue
      }
      decl.positions.push({
        questionId: p.questionId,
        value,
        quote: p.quote,
        sourceUrl: p.sourceUrl || '',
        page: p.page || '',
        inferred: Boolean(p.inferred || fv.shouldBeInferred),
        note: note || '',
        previousValue: p.previousValue,
      })
    }
    if (decl.positions.length) accepted.push(decl)
    else rejected.push({ declarationId: d.id, questionId: null, reason: 'aucune position retenue après relecture' })
  }
  const website = prov && prov.websiteVerdict === 'accept' ? proposal.officialWebsite : ''
  return { accepted, rejected, website }
}

async function researchAndVerify(c, hint) {
  const tag = hint ? `${c.id}+` : c.id
  const proposal = await agent(researchPrompt(c, hint), { label: `recherche:${tag}`, phase: hint ? 'Complétude' : 'Recherche', schema: RESEARCH })
  if (!proposal) return { id: c.id, failed: true, accepted: [], rejected: [], searched: '', statusNews: '', problems: ['recherche interrompue'], website: '' }
  const base = { id: c.id, searched: proposal.searched, statusNews: proposal.statusNews, problems: proposal.problems || [] }
  const proposed = (proposal.declarations || []).reduce((n, d) => n + (d.positions || []).length, 0)
  if (!proposed && !proposal.officialWebsite) return Object.assign(base, { proposed: 0, accepted: [], rejected: [], website: '' })
  const [fid, prov] = await parallel([
    () => agent(fidelityPrompt(c, proposal), { label: `fidélité:${tag}`, phase: 'Vérification', schema: VERDICTS }),
    () => agent(provenancePrompt(c, proposal), { label: `provenance:${tag}`, phase: 'Vérification', schema: VERDICTS }),
  ])
  const verdict = decide(c, proposal, fid, prov)
  const kept = verdict.accepted.reduce((n, d) => n + d.positions.length, 0)
  log(`${c.name} : ${proposed} position(s) proposée(s), ${kept} retenue(s) après double relecture`)
  return Object.assign(base, { proposed }, verdict)
}

const STATUS = {
  type: 'object',
  properties: {
    changes: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          candidateId: { type: 'string' },
          status: { type: 'string', enum: ['declared', 'designated', 'primary', 'potential', 'withdrawn'] },
          declaredOn: { type: ['string', 'null'] },
          statusNote: { type: 'string' },
          primary: { type: ['string', 'null'] },
          sources: { type: 'array', items: { type: 'object', properties: { title: { type: 'string' }, url: { type: 'string' }, date: { type: 'string' } }, required: ['title', 'url', 'date'] } },
          verdict: { type: 'string', enum: ['proposed', 'accept', 'reject'] },
          reason: { type: 'string' },
        },
        required: ['candidateId', 'status', 'declaredOn', 'statusNote', 'primary', 'sources', 'verdict', 'reason'],
      },
    },
    newCandidates: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string' }, firstName: { type: 'string' }, lastName: { type: 'string' }, displayName: { type: 'string' },
          party: { type: 'string' }, partyShort: { type: 'string' },
          status: { type: 'string', enum: ['declared', 'designated', 'primary', 'potential'] },
          declaredOn: { type: ['string', 'null'] }, statusNote: { type: 'string' }, primary: { type: ['string', 'null'] }, website: { type: ['string', 'null'] },
          sources: { type: 'array', items: { type: 'object', properties: { title: { type: 'string' }, url: { type: 'string' }, date: { type: 'string' } }, required: ['title', 'url', 'date'] } },
          verdict: { type: 'string', enum: ['proposed', 'accept', 'reject'] },
          reason: { type: 'string' },
        },
        required: ['id', 'firstName', 'lastName', 'displayName', 'party', 'partyShort', 'status', 'declaredOn', 'statusNote', 'primary', 'website', 'sources', 'verdict', 'reason'],
      },
    },
    primaries: { type: 'string', description: 'changements de calendrier ou résultats de primaires, avec sources ; chaîne vide sinon' },
    notes: { type: 'string' },
  },
  required: ['changes', 'newCandidates', 'primaries', 'notes'],
}

async function statusSweep() {
  const roster = CANDIDATES.map((c) => `- ${c.id} · ${c.name} · ${c.status}`).join('\n')
  const found = await agent(
    `${RULES}

MISSION : STATUTS DES CANDIDATURES. Voici les candidatures suivies (data/candidates.json fait foi pour les détails : dates, notes, primaires, sources) :
${roster}

Cherche les faits nouveaux publiés du ${SINCE} au ${TODAY} : nouvelles candidatures déclarées, retraits, candidatures officialisées, désignations par un parti, primaires (calendrier, candidatures déposées ou retenues, résultats), inéligibilités, ralliements. Pour un STATUT (et seulement pour un statut), la presse est une source acceptable : au moins deux sources fiables et indépendantes, ou une source officielle (parti, candidat·e, Conseil constitutionnel). Ne signale que ce qui change réellement par rapport à data/candidates.json.
Pour chaque changement, donne le nouvel état complet des champs (status, declaredOn, statusNote en une phrase factuelle, primary = identifiant de primaire existant ou null, sources datées) avec verdict = "proposed". Pour une nouvelle candidature : seulement une personne qui s'est déclarée elle-même (ou a été désignée par son parti) dans une annonce vérifiable, pas une rumeur ; id en minuscules avec tirets (nom de famille), verdict = "proposed".`,
    { label: 'statuts', phase: 'Statuts', schema: STATUS },
  )
  if (!found || (!found.changes.length && !found.newCandidates.length)) return found || { changes: [], newCandidates: [], primaries: '', notes: 'recherche interrompue' }
  const checked = await agent(
    `${RULES}

RELECTURE ADVERSE — STATUTS. Une recherche propose les changements ci-dessous dans data/candidates.json. Pour CHACUN, ouvre les sources et cherche de ton côté : le fait est-il établi (deux sources fiables indépendantes ou une source officielle), daté, et bien nouveau par rapport au fichier ? La note de statut est-elle factuelle et neutre ? Mets verdict = "accept" ou "reject" avec reason, et corrige les champs si besoin. Dans le doute : reject.

PROPOSITION :
${JSON.stringify(found, null, 1)}`,
    { label: 'statuts:relecture', phase: 'Statuts', schema: STATUS },
  )
  return checked || Object.assign({}, found, { changes: [], newCandidates: [], notes: 'relecture interrompue : aucun changement retenu' })
}

const CRITIC = {
  type: 'object',
  properties: {
    leads: {
      type: 'array',
      items: {
        type: 'object',
        properties: { candidateId: { type: 'string' }, url: { type: 'string' }, title: { type: 'string' }, date: { type: 'string' }, why: { type: 'string' } },
        required: ['candidateId', 'url', 'title', 'date', 'why'],
      },
    },
  },
  required: ['leads'],
}

async function critic(results) {
  const lines = results.map((r) => {
    const c = CANDIDATES.find((x) => x.id === r.id)
    const got = (r.accepted || []).map((d) => `${d.date} ${d.title} <${d.sourceUrl}>`).join(' ; ')
    const no = (r.rejected || []).filter((x) => !x.questionId).map((x) => x.declarationId).join(', ')
    return `- ${r.id} (${c ? c.name : r.id}, période du ${c ? windowFor(c) : SINCE}) : ${got || 'rien retenu'}${no ? ` · écartées : ${no}` : ''}`
  })
  return agent(
    `${RULES}

RELECTURE DE COMPLÉTUDE. La veille du ${SINCE} au ${TODAY} a donné ceci, candidat·e par candidat·e :
${lines.join('\n')}

Ton rôle : trouver ce qui a été MANQUÉ. Cherche, pour chaque candidat·e, les publications officielles majeures de sa période : lancement ou nouvelle version d'un programme, discours de meeting ou de rentrée publié sur un site officiel, communiqués ou tribunes sur des sujets des 163 affirmations, propositions de loi déposées. Ne retiens que des pistes vraisemblablement officielles, dans la période, et absentes de la liste ci-dessus et des déclarations déjà enregistrées (\`npm run -s data:brief -- <id>\`). Une piste = une URL précise, idéalement le document officiel lui-même. Aucune piste n'est une réponse valable.`,
    { label: 'complétude', phase: 'Complétude', schema: CRITIC },
  )
}

// ---------------------------------------------------------------------------------------------------------

log(`Veille du ${SINCE} au ${TODAY} : ${CANDIDATES.length} candidat·es, dont ${CANDIDATES.filter((c) => !c.positions).length} en premier encodage`)

const [status, results] = await Promise.all([
  A.statusSweep === false ? Promise.resolve(null) : statusSweep(),
  pipeline(CANDIDATES, (c) => researchAndVerify(c, null)),
])

let followUps = []
if (A.critic !== false) {
  const review = await critic(results.filter(Boolean))
  const leads = ((review && review.leads) || []).filter((l) => CANDIDATES.some((c) => c.id === l.candidateId))
  const known = new Set(results.filter(Boolean).flatMap((r) => (r.accepted || []).map((d) => d.sourceUrl)))
  const fresh = leads.filter((l) => !known.has(l.url))
  const byCandidate = new Map()
  for (const l of fresh) byCandidate.set(l.candidateId, (byCandidate.get(l.candidateId) || []).concat([l]))
  log(`Complétude : ${fresh.length} piste(s) nouvelle(s) pour ${byCandidate.size} candidat·e(s)`)
  followUps = await pipeline([...byCandidate.entries()], ([id, hint]) => researchAndVerify(CANDIDATES.find((c) => c.id === id), hint))
}

const all = results.concat(followUps).filter(Boolean)
return {
  window: { since: SINCE, today: TODAY },
  status,
  candidates: all,
  totals: {
    proposed: all.reduce((n, r) => n + (r.proposed || 0), 0),
    accepted: all.reduce((n, r) => n + (r.accepted || []).reduce((m, d) => m + d.positions.length, 0), 0),
    declarations: all.reduce((n, r) => n + (r.accepted || []).length, 0),
    failed: all.filter((r) => r.failed).map((r) => r.id),
  },
}
