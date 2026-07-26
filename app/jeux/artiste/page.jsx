'use client';
import StandaloneGame from '@/components/StandaloneGame';
import { JeuArtiste } from '@/components/dailyGames';

export default function Page() {
  return (
    <StandaloneGame
      titre="Trouve l'artiste"
      description="Devine l'artiste mystère grâce aux indices comparés. Version libre : rejoue autant que tu veux."
      Jeu={JeuArtiste}
    />
  );
}