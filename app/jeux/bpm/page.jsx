'use client';
import StandaloneGame from '@/components/StandaloneGame';
import { JeuBPM } from '@/components/dailyGames';

export default function Page() {
  return (
    <StandaloneGame
      titre="Trouve le BPM"
      description="Écoute l'extrait et retrouve son tempo au métronome. Version libre : rejoue autant que tu veux."
      Jeu={JeuBPM}
    />
  );
}