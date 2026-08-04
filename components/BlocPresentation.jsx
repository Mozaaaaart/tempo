import { presentationDuSlug } from '@/data/presentations';

/**
 * Bloc de présentation posé SOUS la scène de jeu.
 *
 * -------------------------------------------------------------- côté serveur
 *
 * Pas de directive 'use client', et c'est le point qui décide de tout : les
 * jeux sont des composants clients, un texte placé dedans n'arrive qu'après
 * l'hydratation et pèse beaucoup moins pour un moteur. Celui-ci est rendu
 * dans le document HTML servi par le CDN, au même titre que le titre de page.
 *
 * ------------------------------------------------------------------ la place
 *
 * SOUS le jeu, jamais au-dessus. Le joueur qui vient jouer ne le rencontre
 * pas ; celui qui descend le cherche. C'est ce qui permet d'ajouter trois
 * cents mots à une page sans rien retirer à ce qu'elle était.
 *
 * ---------------------------------------------------------------- l'axe
 *
 * DEUX NIVEAUX, ET C'EST TOUT L'ENJEU DE MISE EN PAGE.
 *
 * Le filet de séparation prend la LARGEUR ENTIÈRE : c'est la grammaire des
 * ruptures de section partout ailleurs sur le site, du bandeau d'action à la
 * grille des dix jeux. Un filet court, aligné à gauche sous un panneau
 * centré, se lisait comme un trait oublié.
 *
 * Le texte, lui, reste dans une colonne de 620 px CENTRÉE. Une ligne cesse
 * d'être lisible au-delà d'une soixantaine de signes — l'œil perd le début du
 * rang suivant — et c'est déjà pour cette raison que les descriptions du site
 * sont bornées à 470. Centrée, la colonne partage l'axe du panneau de jeu ;
 * alignée à gauche, elle flottait sans rapport avec lui.
 *
 * ------------------------------------------------------------- l'apparence
 *
 * Aucun élément nouveau. Filet, étiquette mono, classe `description`, titres :
 * tout existe déjà dans la feuille. Pas de carte, pas d'icône, pas de seconde
 * couleur. Le bloc se lit comme la suite de la page parce qu'il en emploie
 * exactement la grammaire.
 *
 * Les deux étiquettes mono font le travail que fait ailleurs le sommaire :
 * elles annoncent ce qui vient et permettent de sauter ce qu'on ne cherche
 * pas. Sans elles, trois cents mots de lin sur du noir forment un pavé qu'on
 * dépasse des yeux.
 */
export default function BlocPresentation({ slug }) {
  const p = presentationDuSlug(slug);
  if (!p) return null;

  return (
    <section
      style={{
        marginTop: 'var(--e8)',
        paddingTop: 'var(--e6)',
        borderTop: '0.5px solid var(--filet)',
      }}
    >
      <div style={{ maxWidth: 620, margin: '0 auto' }}>
        <div className="etiquette-mono" style={{ color: 'var(--cendre)' }}>
          pour aller plus loin
        </div>

        {/* <h2> et non <h3> : les pages passaient du <h1> du titre au <h3> des
            panneaux de jeu, sans niveau intermédiaire. Une hiérarchie de
            titres qui saute un cran se lit comme une structure cassée, pour un
            moteur comme pour un lecteur d'écran. */}
        <h2
          className="titre-section"
          style={{ marginTop: 'var(--e2)', marginBottom: 'var(--e4)', fontSize: 20 }}
        >
          {p.titre}
        </h2>

        {p.paragraphes.map((texte) => (
          <p
            key={texte.slice(0, 24)}
            className="description"
            style={{
              marginBottom: 'var(--e3)',
              fontSize: 13.5,
              lineHeight: 1.75,
              textWrap: 'pretty',
            }}
          >
            {texte}
          </p>
        ))}

        {p.questions?.length > 0 && (
          <div style={{ marginTop: 'var(--e7)' }}>
            <div
              className="etiquette-mono"
              style={{ color: 'var(--cendre)', marginBottom: 'var(--e4)' }}
            >
              questions fréquentes
            </div>

            {p.questions.map((item, i) => (
              <div
                key={item.q}
                style={{
                  /* Un filet entre les questions, jamais avant la première :
                     la première est déjà séparée par son étiquette. Les
                     réponses forment ainsi une liste qu'on parcourt, et non
                     trois paragraphes de plus. */
                  borderTop: i === 0 ? 'none' : '0.5px solid var(--filet)',
                  paddingTop: i === 0 ? 0 : 'var(--e4)',
                  marginBottom: 'var(--e4)',
                }}
              >
                <h3
                  style={{
                    fontFamily: 'var(--sans)',
                    fontSize: 14,
                    fontWeight: 500,
                    color: 'var(--ivoire)',
                    marginBottom: 'var(--e2)',
                  }}
                >
                  {item.q}
                </h3>
                <p
                  className="description"
                  style={{ fontSize: 13.5, lineHeight: 1.75, textWrap: 'pretty' }}
                >
                  {item.r}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}