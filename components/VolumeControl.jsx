'use client';
import { useRef } from 'react';
import { useNiveau, ecrireVolume, useActif, ecrireActif } from '@/utils/volume';

/**
 * Curseur de volume pour les pages d'épreuve.
 *
 * Distinct du bouton d'Ambiance : ici il n'y a ni musique de fond ni
 * AudioContext à réveiller au premier geste, seulement un NIVEAU (0–1) que
 * chaque jeu applique lui-même à ses propres sources (<audio>, Tone.js).
 * Écrit sous la même clé que le curseur de l'accueil : un réglage fait sur
 * l'une des deux pages est donc repris par l'autre à la prochaine visite.
 *
 * Le rond bordé reprend le langage visuel du bouton d'Ambiance, y compris
 * le geste : un clic dessus coupe le son en mémorisant le niveau courant, un
 * second clic le restaure — exactement comme sur la page d'accueil.
 */
export default function VolumeControl({ compact = false }) {
  /* Le curseur affiche le NIVEAU, pas le volume effectif : une coupure ne doit
     pas ramener la poignée à zéro, sinon le réglage est perdu et le
     rétablissement repart d'une valeur arbitraire. */
  const volume = useNiveau();
  const actif = useActif();
  /* Coupé si le niveau est à zéro OU si l'ambiance a été éteinte depuis
     l'accueil. Sans ce second cas, le bouton affichait un haut-parleur intact
     alors que le site était silencieux, et le rétablir ici n'avait aucun
     effet — il fallait retourner sur l'accueil. */
  const coupe = volume === 0 || !actif;
  const taille = compact ? 28 : 34;

  // Mémorise le dernier niveau non nul, pour le restaurer au clic suivant.
  // Propre à cette instance : rien à persister, la page se remonte à chaque
  // navigation et repart de la vraie valeur stockée.
  const dernierVolumeRef = useRef(0.5);
  if (volume > 0) dernierVolumeRef.current = volume;

  /* Les deux réglages basculent ensemble : couper ici éteint aussi l'ambiance,
     rétablir la rallume. C'est la seule façon d'avoir un contrôle qui tienne
     sa promesse depuis n'importe quelle page — un bouton « son coupé » qui ne
     lève que la moitié de la coupure n'est pas un bouton, c'est un piège. */
  function basculerCoupure() {
    if (coupe) {
      if (volume === 0) ecrireVolume(dernierVolumeRef.current || 0.5);
      ecrireActif(true);
    } else {
      ecrireVolume(0);
      ecrireActif(false);
    }
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--e2)' }}>
      {/* Classe distincte de .mb-volume (Ambiance.jsx) : les deux ne
          coexistent jamais sur la même page, mais autant éviter toute
          collision si ça changeait un jour. */}
      <style>{`
        .mb-volume-e {
          -webkit-appearance: none; appearance: none;
          width: 100%; height: 14px; background: transparent;
          cursor: pointer; outline: none; margin: 0;
        }
        .mb-volume-e::-webkit-slider-runnable-track {
          height: 3px; border-radius: 2px;
          background: linear-gradient(to right, var(--or) 0 var(--remplissage), var(--filet) var(--remplissage) 100%);
        }
        .mb-volume-e::-moz-range-track {
          height: 3px; border-radius: 2px;
          background: linear-gradient(to right, var(--or) 0 var(--remplissage), var(--filet) var(--remplissage) 100%);
        }
        .mb-volume-e::-webkit-slider-thumb {
          -webkit-appearance: none;
          width: 11px; height: 11px; border-radius: 50%;
          background: var(--or); border: none; margin-top: -4px;
          transition: transform 140ms ease;
        }
        .mb-volume-e::-moz-range-thumb {
          width: 11px; height: 11px; border-radius: 50%;
          background: var(--or); border: none;
        }
        .mb-volume-e:hover::-webkit-slider-thumb,
        .mb-volume-e:active::-webkit-slider-thumb { transform: scale(1.3); }
      `}</style>

      {/* Rond bordé, même gabarit que le bouton d'Ambiance (34px / 28px
          compact), et désormais cliquable comme lui : coupe / restaure. */}
      <button
        type="button"
        onClick={basculerCoupure}
        aria-label={coupe ? 'Rétablir le son' : 'Couper le son'}
        style={{
          width: taille,
          height: taille,
          borderRadius: '50%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
          padding: 0,
          background: 'transparent',
          cursor: 'pointer',
          border: '1px solid var(--or)',
          color: 'var(--or)',
          transition: 'color var(--transition-courte), border-color var(--transition-courte)',
        }}
      >
        <svg width="15" height="15" viewBox="0 0 20 20" fill="none" stroke="currentColor"
          strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M4 8v4h3l4 3V5L7 8H4z" />
          {coupe ? (
            <path d="M14 8l4 4M18 8l-4 4" />
          ) : (
            <>
              <path d="M14 7.5a3.6 3.6 0 0 1 0 5" />
              <path d="M16.2 5.2a7 7 0 0 1 0 9.6" />
            </>
          )}
        </svg>
      </button>

      <input
        type="range"
        min="0"
        max="1"
        step="0.01"
        value={volume}
        onChange={(e) => {
          const v = parseFloat(e.target.value);
          ecrireVolume(v);
          // Remonter le curseur depuis zéro rallume l'ambiance : sinon le son
          // resterait absent alors que le curseur affiche un niveau.
          if (v > 0 && !actif) ecrireActif(true);
        }}
        aria-label="Volume du son de jeu"
        aria-valuetext={`${Math.round(volume * 100)} %`}
        className="mb-volume-e"
        style={{ width: compact ? 64 : 84, '--remplissage': `${volume * 100}%` }}
      />
    </div>
  );
}