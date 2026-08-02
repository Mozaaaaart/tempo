'use client';
import { useEffect, useRef, useState } from 'react';
import { setSeedSalt } from '@/components/dailyGames';
import { tirerVariante } from '@/utils/variante';
import { jeuDuSlug } from '@/components/registreJeux';
import { useEpreuve } from '@/components/EpreuveContext';

/**
 * Monte le jeu correspondant au slug.
 *
 * La table slug → composant a quitté ce fichier pour components/registreJeux.js :
 * elle est maintenant partagée avec le défi quotidien, et vérifiée contre
 * data/epreuves.js au build. C'est le seul changement par rapport à la
 * version précédente — le reste de la mécanique est inchangé.
 *
 * Le rendu est différé au montage client : le salt étant aléatoire, un rendu
 * serveur produirait un tirage différent de celui du client (mismatch
 * d'hydratation).
 *
 * setSeedSalt() doit être appelé pendant le rendu, AVANT que le jeu ne rende :
 * les jeux appellent seeded() dès leur initialisation. Le poser dans un
 * useEffect arriverait trop tard d'un cycle.
 */
export default function JeuSlot({ slug }) {
  const { cleRelance } = useEpreuve();
  const [monte, setMonte] = useState(false);
  const saltRef = useRef(null);
  const marqueRef = useRef(null);

  useEffect(() => {
    setMonte(true);
  }, []);

  // Une marque par couple (épreuve, relance) : nouveau tirage à chaque fois
  // qu'on arrive sur l'épreuve ou qu'on clique sur « Relancer ».
  const marque = `${slug}|${cleRelance}`;

  if (monte) {
    if (marqueRef.current !== marque) {
      marqueRef.current = marque;
      /* Variante bornée plutôt qu'un salt aléatoire sur un espace infini.
         Un salt inédit à chaque relance produisait des URL d'API inédites,
         donc autant de manques de cache et d'appels en amont : la charge
         croissait avec le trafic. Voir utils/variante.js. */
      saltRef.current = tirerVariante();
    }
    setSeedSalt(saltRef.current);
  }

  const Jeu = jeuDuSlug(slug);
  if (!Jeu) return null;

  if (!monte) {
    return (
      <p className="lin" style={{ fontSize: 13 }}>
        Chargement de l&apos;épreuve…
      </p>
    );
  }

  // La clé force un remontage complet à la relance : état interne remis à zéro.
  // Pas de prop `daily` ici : c'est justement le mode libre, avec relance
  // illimitée à l'intérieur de chaque jeu.
  return <Jeu key={marque} onDone={() => {}} />;
}