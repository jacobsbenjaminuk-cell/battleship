import { useState } from 'react';
import { DIFFICULTY_LABELS, type Difficulty, type GameState } from '../core';
import { exportGame, type Commitment } from './fairness';

type CommitmentProps = { readonly commitment: Commitment | null };

/** The published hash, shown from the moment the enemy fleet is dealt. */
export function FairnessNote({ commitment }: CommitmentProps) {
  if (!commitment) return null;
  return (
    <div className="flex flex-col gap-1 bg-panel px-4 py-3 text-xs text-muted">
      <span className="tracking-[0.2em] uppercase">Fairness commitment</span>
      <p className="leading-relaxed">
        The enemy fleet was placed before your first shot: this is a SHA-256 of its layout and a
        random salt, so the layout cannot change and is revealed to you when the battle ends.
      </p>
      <code className="break-all text-steel">{commitment.hash}</code>
    </div>
  );
}

type RevealProps = CommitmentProps & {
  readonly state: GameState;
  readonly seed: number;
  readonly difficulty: Difficulty;
};

/** The reveal: salt and layout, checkable against the hash shown at the start. */
export function FairnessReveal({ commitment, state, seed, difficulty }: RevealProps) {
  if (!commitment) return null;

  const fleet = commitment.layout
    .map((ship) => `${ship.shipId} ${ship.cells.join(' ')}`)
    .join('\n');

  return (
    <div className="flex flex-col gap-3 bg-panel px-6 py-5 text-xs text-muted">
      <span className="tracking-[0.2em] uppercase">Fairness reveal</span>
      <p className="leading-relaxed">
        Hash the layout and salt below and you get the commitment published before your first shot,
        which is how you know the enemy fleet never moved.
      </p>

      <Field label="Hash" value={commitment.hash} />
      <Field label="Salt" value={commitment.salt} />
      <Field label="Enemy fleet" value={fleet} multiline />

      <div className="flex flex-wrap gap-[2px]">
        <CopyButton label="Copy preimage" value={commitment.preimage} />
        <button
          type="button"
          onClick={() => download(state, commitment, seed, difficulty)}
          className="bg-sea px-3 py-2 text-xs text-ink transition-colors duration-[120ms] ease-out hover:bg-sea-hover"
        >
          Export game JSON
        </button>
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  multiline = false,
}: {
  readonly label: string;
  readonly value: string;
  readonly multiline?: boolean;
}) {
  return (
    <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:gap-3">
      <span className="w-24 shrink-0 tracking-[0.15em] uppercase">{label}</span>
      <code className={`flex-1 break-all text-steel ${multiline ? 'whitespace-pre-line' : ''}`}>
        {value}
      </code>
      <CopyButton label="Copy" value={value} />
    </div>
  );
}

function CopyButton({ label, value }: { readonly label: string; readonly value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={() => {
        void navigator.clipboard.writeText(value).then(() => {
          setCopied(true);
          window.setTimeout(() => setCopied(false), 1500);
        });
      }}
      className="shrink-0 bg-sea px-3 py-1 text-xs text-ink transition-colors duration-[120ms] ease-out hover:bg-sea-hover"
    >
      {copied ? 'Copied' : label}
    </button>
  );
}

function download(
  state: GameState,
  commitment: Commitment,
  seed: number,
  difficulty: Difficulty,
): void {
  const payload = JSON.stringify(exportGame(state, commitment, seed, difficulty), null, 2);
  const url = URL.createObjectURL(new Blob([payload], { type: 'application/json' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = `battleship-${DIFFICULTY_LABELS[difficulty].toLowerCase()}-${seed}.json`;
  link.click();
  URL.revokeObjectURL(url);
}
