'use client';
import StandaloneGame from '@/components/StandaloneGame';
import { JeuRefrain } from '@/components/dailyGames';

export default function Page() {
  return (
    <StandaloneGame
      titre="Complète le refrain"
      description="Trois lignes données, tape la suivante. Version libre : rejoue autant que tu veux."
      Jeu={JeuRefrain}
    />
  );
}