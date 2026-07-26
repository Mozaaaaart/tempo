'use client';
import StandaloneGame from '@/components/StandaloneGame';
import { JeuPochette } from '@/components/dailyGames';

export default function Page() {
  return (
    <StandaloneGame
      titre="Pochette floutée"
      description="Le flou diminue à chaque erreur. Version libre : rejoue autant que tu veux."
      Jeu={JeuPochette}
    />
  );
}