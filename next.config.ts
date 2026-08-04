import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /**
   * Redirections permanentes d'anciennes URL.
   *
   * `/epreuves/refrain` et `/epreuves/une-seconde` ont été servis, listés dans
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
      {
        source: '/epreuves/refrain',
        destination: '/epreuves/paroles',
        permanent: true,
      },
      {
        source: '/epreuves/une-seconde',
        destination: '/epreuves/blind-test',
        permanent: true,
      },
    ];
  },
};

export default nextConfig;