'use client';
import StandaloneGame from '@/components/StandaloneGame';
import { JeuParoles } from '@/components/dailyGames';

export default function Page() {
  return (
    <StandaloneGame
      titre="Paroles mystères"
      description="Retrouve le morceau à partir d'un extrait de paroles. Version libre : rejoue autant que tu veux."
      Jeu={JeuParoles}
    />
  );
}