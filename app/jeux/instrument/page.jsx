'use client';
import StandaloneGame from '@/components/StandaloneGame';
import { JeuInstrument } from '@/components/dailyGames';

export default function Page() {
  return (
    <StandaloneGame
      titre="Trouve l'instrument"
      description="Un timbre acoustique mystère joue le même air. Version libre : rejoue autant que tu veux."
      Jeu={JeuInstrument}
    />
  );
}