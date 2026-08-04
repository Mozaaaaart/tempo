import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /**
   * Redirections permanentes d'anciennes URL.
   *
   * DEUX FAMILLES. D'abord le déménagement de `/epreuves/` vers `/jeux/` : le
   * site parlait le vocabulaire de l'évaluation, il parle maintenant celui du
   * jeu, et l'adresse devait suivre. Le motif `:slug*` couvre les dix jeux
   * d'une seule règle, la ligne sans paramètre couvre la page catalogue.
   *
   * Ensuite les renommages d'épreuves. `/epreuves/refrain` et
   * `/epreuves/une-seconde` ont été servis, listés dans
   * le plan du site et soumis à Google avant que leurs épreuves soient
   * renommées « Paroles » et « Blind test ». Un slug indexé ne meurt jamais
   * tout à fait : il reste dans des favoris, dans des liens, et dans l'index
   * tant que le moteur ne l'a pas revisité.
   *
   * `permanent: true` produit un 308, qui transfère le classement acquis vers
   * la nouvelle adresse. Un 307 laisserait l'ancienne URL vivre sa vie dans
   * l'index et diviserait le signal entre deux pages pour un seul contenu.
   *
   * À conserver indéfiniment. Le coût est nul, le retrait ne rapporte rien.
   */
  async redirects() {
    return [
      /* Les renommages EN PREMIER : Next évalue les règles dans l'ordre, et
         une entrée `/epreuves/:slug*` placée avant capterait `refrain` pour
         l'envoyer sur `/jeux/refrain`, qui n'existe pas. Traitées ici, elles
         redirigent directement vers la bonne adresse finale — une seule
         redirection au lieu de deux enchaînées, ce que les moteurs
         préfèrent nettement. */
      {
        source: '/epreuves/refrain',
        destination: '/jeux/paroles',
        permanent: true,
      },
      {
        source: '/epreuves/une-seconde',
        destination: '/jeux/blind-test',
        permanent: true,
      },
      /* Puis le déménagement, qui ramasse tout le reste. */
      {
        source: '/epreuves',
        destination: '/jeux',
        permanent: true,
      },
      {
        source: '/epreuves/:slug*',
        destination: '/jeux/:slug*',
        permanent: true,
      },
    ];
  },
};

export default nextConfig;