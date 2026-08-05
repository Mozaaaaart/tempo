import PageTexte from '@/components/PageTexte';

/**
 * SOUTENIR
 *
 * Page de dons libres. Elle ne mentionne AUCUN frais du projet — choix de
 * l'éditeur : énumérer des coûts sonnait comme une justification à fournir,
 * et le don ne se justifie pas. La formulation « libre et sans contrepartie
 * d'aucune sorte » n'est PAS décorative : elle documente la position fiscale
 * et juridique de l'éditeur. Un don avec contrepartie est une vente ; une
 * vente est une activité économique ; une activité économique fait basculer
 * le site dans le champ de l'art. 3:15d BW et met fin au régime non
 * professionnel ET à l'anonymat de l'éditeur. Cette phrase est la clef de
 * voûte du cadre : ne jamais la remplacer par « débloquez », « accédez à »,
 * ni par des paliers à récompenses.
 *
 * ÉTAT : PAGE ACTIVE. Le lien Ko-fi est renseigné, la page est indexable,
 * référencée dans le pied de page et déclarée au sitemap. Si le lien devait
 * disparaître un jour, repasser LIEN_KOFI à null suffit à rendre la page
 * honnête (le paragraphe de repli prend le relais), mais il faudrait AUSSI
 * la repasser en noindex et la retirer du pied et du sitemap — un lien mort
 * est pire que pas de page.
 *
 * Tutoiement : page conversationnelle.
 */

const LIEN_KOFI = 'https://ko-fi.com/mozartbenchmark';

export const metadata = {
  title: 'Soutenir',
  description:
    'Soutenir Mozart Benchmark par un don libre, sans contrepartie.',
  alternates: { canonical: '/soutenir' },
  robots: { index: true, follow: true },
};

export default function Soutenir() {
  return (
    <PageTexte etiquette="le projet" titre="Soutenir">
      {/* Le mot personnel AVANT l'argent : on ne demande pas de soutenir un
          site, on soutient quelqu'un — le paragraphe donne un visage au
          projet, l'encadre de don arrive apres. Tutoiement, comme le reste
          de la page : la voix du site tranche par page et celle-ci est
          conversationnelle. */}
      <p>
        Hello, moi c&rsquo;est Nat. Comme beaucoup, j&rsquo;écoute de la musique
        tous les jours, dans les transports, en travaillant, un peu partout.
        Avec ce site, j&rsquo;ai voulu réunir deux univers que
        j&rsquo;aime&nbsp;beaucoup : la musique et le gaming. Je le développe seul.
        J&rsquo;espère que tu y passes un bon moment.
      </p>
      {/* Aucune mention des frais du projet, deliberement : les enumerer
          sonnait comme une justification a fournir. Le don ne se justifie
          pas, il s'offre — seule reste l'invitation, et la phrase de
          contrepartie qui verrouille le cadre juridique. */}
      <p>
        Si le site te plaît, tu peux faire un don, seulement si tu le veux
        et si tu le peux. <strong>Le don est libre et sans contrepartie
        d&rsquo;aucune sorte</strong>&nbsp;: il ne débloque rien, ne donne
        accès à rien, et le site reste identique pour tout le monde.{' '}
        {/* L'or sur le remerciement, et sur rien d'autre de ce paragraphe :
            c'est la seule phrase de la page qui s'adresse a quelqu'un plutot
            que de decrire un cadre, et l'or est la couleur unique d'accent du
            site — deux elements dores dans la meme zone et plus rien ne
            ressort. Un span et non un lien : rien ne se clique ici. */}
        <span className="soutenir-merci">Merci pour ton soutien&nbsp;!</span>
      </p>
      <style>{`
        /* Aucun accent grave dans ce bloc : il vit dans un gabarit, et un
           accent grave isole y refermerait la chaine CSS en plein milieu. */
        .soutenir-merci { color: var(--or); }
      `}</style>

      {LIEN_KOFI ? (
        <div className="texte-encadre">
          <a href={LIEN_KOFI} rel="noopener noreferrer">
            Soutenir le projet
          </a>
        </div>
      ) : (
        /* Emplacement du bouton : rien n'est rendu tant que LIEN_KOFI est
           null. Le paragraphe ci-dessous prend le relais pour que la page
           reste honnête si quelqu'un y arrive par une URL directe. */
        <p>
          Le lien de don n&rsquo;est pas encore en place. En attendant, la
          meilleure façon de soutenir le projet est d&rsquo;en parler autour
          de toi.
        </p>
      )}

      {/* Le futur finance par les dons est decrit comme un futur DU SITE,
          ouvert a tous — jamais comme un avantage du donateur : « votre don
          debloquera le multijoueur » serait une contrepartie, et la
          contrepartie fait tomber tout le cadre juridique de la page. */}
      <p>
        Ton soutien va me permettre de développer un nouveau mode de jeu que 
        j&rsquo;affectionne tout particulièrement, et qui devrait aussi te plaire... (Indice&nbsp;:
        multijoueur).
      </p>
    </PageTexte>
  );
}