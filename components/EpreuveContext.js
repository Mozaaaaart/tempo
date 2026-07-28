'use client';
import { createContext, useContext } from 'react';

/**
 * Le bouton « Relancer l'épreuve » vit dans le layout, le jeu vit dans la page.
 * Le layout enveloppant la page, un contexte suffit à faire passer l'ordre de
 * relance vers le bas — pas besoin d'état global ni d'événement custom.
 */
export const EpreuveContext = createContext({
  cleRelance: 0,
  relancer: () => {},
});

export function useEpreuve() {
  return useContext(EpreuveContext);
}