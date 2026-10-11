import { describe, it, expect } from 'vitest';
import { planMoveSounds, planResultSound, SOUND_FILES } from '../audio/soundCatalog';

/** A plain move: no capture, no castle, no promotion, no check. */
const plain = {
  isCapture: false,
  isCastle: false,
  isPromotion: false,
  isCheck: false,
  isCheckmate: false,
  isDraw: false,
};

describe('move sound selection', () => {
  it('plays the player move sound for a pawn move', () => {
    // White pawn e2-e4: the sound depends on who moved, never on the piece.
    expect(planMoveSounds({ ...plain, actor: 'player' }).immediate).toBe('moveSelf');
  });

  it('plays the same player move sound for a knight move', () => {
    // White knight g1-f3 must sound exactly like the pawn move above.
    expect(planMoveSounds({ ...plain, actor: 'player' }).immediate).toBe('moveSelf');
  });

  it('plays the opponent move sound for AI pawn and knight moves', () => {
    expect(planMoveSounds({ ...plain, actor: 'opponent' }).immediate).toBe('moveOpponent');
  });

  it('prefers capture over the ordinary move', () => {
    expect(planMoveSounds({ ...plain, actor: 'player', isCapture: true }).immediate).toBe('capture');
    expect(planMoveSounds({ ...plain, actor: 'opponent', isCapture: true }).immediate).toBe('capture');
  });

  it('prefers castle over the ordinary move', () => {
    expect(planMoveSounds({ ...plain, actor: 'player', isCastle: true }).immediate).toBe('castle');
  });

  it('prefers promotion over the ordinary move', () => {
    expect(planMoveSounds({ ...plain, actor: 'player', isPromotion: true }).immediate).toBe('promote');
  });

  it('uses the actor-specific check sound', () => {
    expect(planMoveSounds({ ...plain, actor: 'player', isCheck: true }).immediate).toBe('moveSelfCheck');
    expect(planMoveSounds({ ...plain, actor: 'opponent', isCheck: true }).immediate).toBe('moveOpponentCheck');
  });

  it('plays a check sound and then the result on checkmate', () => {
    const plan = planMoveSounds({ ...plain, actor: 'player', isCheckmate: true, playerWon: true });
    expect(plan.immediate).toBe('moveSelfCheck');
    expect(plan.follow?.id).toBe('gameWin');
    expect(plan.follow!.delayMs).toBeGreaterThan(0);
  });

  it('says the player lost when the opponent mates', () => {
    const plan = planMoveSounds({ ...plain, actor: 'opponent', isCheckmate: true, playerWon: false });
    expect(plan.immediate).toBe('moveOpponentCheck');
    expect(plan.follow?.id).toBe('gameLose');
  });

  it('plays the draw sound for a drawn game', () => {
    expect(planMoveSounds({ ...plain, actor: 'player', isDraw: true }).immediate).toBe('gameDraw');
  });

  it('never returns more than one immediate sound', () => {
    const plan = planMoveSounds({
      actor: 'player',
      isCapture: true,
      isCastle: true,
      isPromotion: true,
      isCheck: true,
      isCheckmate: false,
      isDraw: false,
    });
    expect(Object.keys(plan).filter((k) => k === 'immediate')).toHaveLength(1);
    expect(plan.immediate).toBe('moveSelfCheck');
  });

  it('maps every sound id to a bundled file', () => {
    for (const [id, file] of Object.entries(SOUND_FILES)) {
      expect(file, `${id} must map to a file`).toMatch(/\.wav$/);
    }
    expect(Object.keys(SOUND_FILES).length).toBeGreaterThanOrEqual(18);
  });
});

describe('result sounds', () => {
  it('reports a win and a loss for the player', () => {
    expect(planResultSound('white', 'w')).toBe('gameWin');
    expect(planResultSound('black', 'b')).toBe('gameWin');
    expect(planResultSound('white', 'b')).toBe('gameLose');
    expect(planResultSound('black', 'w')).toBe('gameLose');
  });

  it('reports a draw for any drawish result', () => {
    expect(planResultSound('stalemate', 'w')).toBe('gameDraw');
    expect(planResultSound('insufficient', 'b')).toBe('gameDraw');
    expect(planResultSound(null, 'w')).toBe('gameDraw');
  });
});
