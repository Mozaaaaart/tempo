'use client';
import StandaloneGame from '@/components/StandaloneGame';
import { JeuSeconde } from '@/components/dailyGames';

export default function Page() {
  return (
    <StandaloneGame
      titre="Une seconde de plus"
      description="Devine le titre ou l'artiste — chaque erreur allonge l'extrait. Version libre : rejoue autant que tu veux."
      Jeu={JeuSeconde}
    />
  );
}