'use client';
import { useEffect, useRef, useState } from 'react';
import {
  setSeedSalt,
  JeuArtiste,
  JeuPochette,
  JeuBPM,
  JeuSeconde,
  JeuInstrument,
  JeuParoles,
  JeuRefrain,
} from '@/components/dailyGames';
import JeuAccordsGame from '@/components/JeuAccordsGame';
import JeuRythmeGame from '@/components/JeuRythmeGame';
import JeuIAGame from '@/components/JeuIAGame';
import { useEpreuve } from '@/components/EpreuveContext';

const JEUX = {
  'accords': JeuAccordsGame,
  'rythme': JeuRythmeGame,
  'artiste': JeuArtiste,
  'pochette': JeuPochette,
  'humain-ou-ia': JeuIAGame,
  'une-seconde': JeuSeconde,
  'tempo': JeuBPM,
  'instrument': JeuInstrument,
  'paroles': JeuParoles,
  'refrain': JeuRefrain,
};

/**
 * Monte le jeu correspondant au slug.
 *
 * Le rendu est différé au montage client : le salt étant aléatoire, un rendu
 * serveur produirait un tirage différent de celui du client (mismatch
 * d'hydratation). Même raison que dans l'ancien StandaloneGame.
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
      saltRef.current = Math.random().toString(36).slice(2);
    }
    setSeedSalt(saltRef.current);
  }

  const Jeu = JEUX[slug];
  if (!Jeu) return null;

  if (!monte) {
    return (
      <p className="lin" style={{ fontSize: 13 }}>
        Chargement de l&apos;épreuve…
      </p>
    );
  }

  // La clé force un remontage complet à la relance : état interne remis à zéro.
  return <Jeu key={marque} onDone={() => {}} />;
}