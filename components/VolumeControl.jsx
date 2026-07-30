'use client';
import { useRef } from 'react';
import { useVolume, ecrireVolume } from '@/utils/volume';

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
  const volume = useVolume();
  const coupe = volume === 0;
  const taille = compact ? 28 : 34;

  // Mémorise le dernier niveau non nul, pour le restaurer au clic suivant.
  // Propre à cette instance : rien à persister, la page se remonte à chaque
  // navigation et repart de la vraie valeur stockée.
  const dernierVolumeRef = useRef(0.5);
  if (volume > 0) dernierVolumeRef.current = volume;

  function basculerCoupure() {
    if (coupe) {
      ecrireVolume(dernierVolumeRef.current || 0.5);
    } else {
      ecrireVolume(0);
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
        onChange={(e) => ecrireVolume(parseFloat(e.target.value))}
        aria-label="Volume du son de jeu"
        aria-valuetext={`${Math.round(volume * 100)} %`}
        className="mb-volume-e"
        style={{ width: compact ? 64 : 84, '--remplissage': `${volume * 100}%` }}
      />
    </div>
  );
}