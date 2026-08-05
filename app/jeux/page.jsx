import { permanentRedirect } from 'next/navigation';
import { EPREUVES, lienEpreuve } from '@/data/epreuves';

/**
 * /jeux — PORTE D'ENTRÉE, PAS PAGE.
 *
 * ------------------------------------------------------------------ le bug
 *
 * Cette route montait un catalogue à l'intérieur du layout des jeux, lequel
 * rend déjà tout le décor d'un jeu : en-tête, titre, onde, carrousel, bandeau
 * d'action. La page recevait donc ce décor, puis reposait le sien — deux
 * en-têtes, deux titres, deux ondes empilés dans le même document.
 *
 * Le layout est par ailleurs bâti pour afficher UN jeu : il lit le slug dans
 * l'URL et retombe sur le premier quand il n'y en a pas. /jeux ouvrait donc
 * « Accords » sans qu'on l'ait demandé, sous un catalogue qui, lui, listait
 * les dix.
 *
 * ------------------------------------------------------------- le correctif
 *
 * La route ne rend plus rien. Elle redirige, et c'est ce qui la rend sûre :
 * permanentRedirect lève avant tout rendu, donc AVANT que le layout ne
 * s'exécute. Aucun décor n'est produit, il n'y a plus rien à dupliquer — et
 * le correctif ne dépend d'aucune autre modification pour tenir.
 *
 * Plus de bloc `metadata` : celui d'une page qui redirige n'est jamais lu, et
 * le laisser aurait fait croire que /jeux porte encore un titre et une
 * canonique propres.
 *
 * 308 ET NON 307. permanentRedirect plutôt que redirect : la redirection est
 * structurelle, pas circonstancielle. Un moteur reporte alors l'autorité de
 * /jeux sur sa cible au lieu de garder les deux URL en mémoire, et les liens
 * externes qui pointeraient un jour sur /jeux ne se perdent pas.
 *
 * LA CIBLE VIENT DU CATALOGUE, pas d'une chaîne écrite ici. Renommer le slug
 * de la première épreuve dans data/epreuves.js ne peut donc pas laisser une
 * redirection morte derrière lui.
 */
export default function Page() {
  permanentRedirect(lienEpreuve(EPREUVES[0].slug));
}