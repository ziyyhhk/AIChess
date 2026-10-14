import React, { useMemo } from 'react';
import type { AnalyzedPly } from '../../analysis/analyzeGame';
import { formatEvaluation } from '../../analysis/analyzeGame';
import { CLASSIFICATION_ICONS } from '../../analysis/iconAssets';
import type { MoveClassification } from '../../analysis/classification';
import { MATE_CP } from '../../analysis/classification';

const WIDTH = 600;
const HEIGHT = 150;
const PAD_X = 10;
const PAD_Y = 12;
const CLAMP_CP = 700;

/** Marked classifications get a dot on the graph. */
const MARKED: MoveClassification[] = [
  'brilliant',
  'great',
  'inaccuracy',
  'mistake',
  'blunder',
  'miss',
];

/** Squash large evaluations so a single mate does not flatten the whole curve. */
function normalise(cp: number): number {
  const clamped = Math.max(-CLAMP_CP, Math.min(CLAMP_CP, cp));
  return Math.tanh(clamped / 450);
}

export function EvalGraph({
  plies,
  selectedPly,
  onSelectPly,
}: {
  plies: AnalyzedPly[];
  selectedPly: number | null;
  onSelectPly: (ply: number) => void;
}) {
  const points = useMemo(() => {
    const total = Math.max(plies.length, 1);
    const step = (WIDTH - PAD_X * 2) / Math.max(1, total);
    // Include the starting evaluation so the curve starts on the left edge.
    const first = plies[0];
    const startValue = first ? first.evalBeforeCpWhite : 0;
    const nodes: { x: number; cp: number; ply: number | null }[] = [
      { x: PAD_X, cp: startValue, ply: null },
      ...plies.map((ply, index) => ({
        x: PAD_X + step * (index + 1),
        cp: ply.evalCpWhite,
        ply: ply.ply,
      })),
    ];
    return { nodes, step };
  }, [plies]);

  const yFor = (cp: number) => {
    const n = normalise(cp);
    // +1 (white winning) at the top, -1 at the bottom.
    return HEIGHT / 2 - (n * (HEIGHT / 2 - PAD_Y));
  };

  const line = points.nodes
    .map((node, index) => `${index === 0 ? 'M' : 'L'} ${node.x.toFixed(2)} ${yFor(node.cp).toFixed(2)}`)
    .join(' ');

  const areaTop = `${line} L ${points.nodes[points.nodes.length - 1]?.x.toFixed(2) ?? PAD_X} ${HEIGHT / 2} L ${PAD_X} ${HEIGHT / 2} Z`;

  const zeroY = yFor(0);
  const last = plies[plies.length - 1];

  return (
    <figure className="eval-graph">
      <figcaption className="eval-graph-head">
        <span>Evaluation over the game</span>
        {last && (
          <span className="eval-graph-final" title="Final evaluated position, White's point of view">
            {formatEvaluation(last.evalCpWhite)}
          </span>
        )}
      </figcaption>
      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        className="eval-graph-svg"
        role="img"
        aria-label={`Evaluation graph for ${plies.length} moves, finishing at ${last ? formatEvaluation(last.evalCpWhite) : '0.00'}`}
      >
        <rect x="0" y="0" width={WIDTH} height={HEIGHT} className="eval-graph-bg" />
        <rect x="0" y="0" width={WIDTH} height={zeroY} className="eval-graph-white-side" />
        <path d={areaTop} className="eval-graph-area" />
        <line x1={0} x2={WIDTH} y1={zeroY} y2={zeroY} className="eval-graph-zero" />
        <path d={line} className="eval-graph-line" />
        {plies.map((ply, index) => {
          if (!MARKED.includes(ply.classification)) return null;
          const node = points.nodes[index + 1];
          if (!node) return null;
          const icon = CLASSIFICATION_ICONS[ply.classification];
          const isSelected = selectedPly === ply.ply;
          return (
            <g key={ply.ply}>
              <circle
                cx={node.x}
                cy={yFor(ply.evalCpWhite)}
                r={isSelected ? 7 : 5}
                fill={icon.color}
                stroke="#0f1114"
                strokeWidth="2"
                className="eval-graph-dot"
              />
              <circle
                cx={node.x}
                cy={yFor(ply.evalCpWhite)}
                r="12"
                fill="transparent"
                className="eval-graph-hit"
                onClick={() => onSelectPly(ply.ply)}
              >
                <title>{`Move ${ply.moveNumber}${ply.side === 'w' ? '.' : '...'} ${ply.san} — ${icon.label}`}</title>
              </circle>
            </g>
          );
        })}
        {Math.abs((last?.evalCpWhite ?? 0)) >= MATE_CP - 1000 && (
          <text x={WIDTH - 6} y={14} textAnchor="end" className="eval-graph-mate">
            forced mate seen
          </text>
        )}
      </svg>
      <div className="eval-graph-axis" aria-hidden>
        <span>White advantage</span>
        <span>Black advantage</span>
      </div>
    </figure>
  );
}
