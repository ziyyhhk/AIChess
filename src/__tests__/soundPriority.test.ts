import { describe, it, expect } from 'vitest';

function pickSound(ctx: {
  isPlayer: boolean;
  isCapture: boolean;
  isCastle: boolean;
  isPromotion: boolean;
  isCheck: boolean;
  isCheckmate: boolean;
  isDraw: boolean;
}): string {
  if (ctx.isCheckmate) return 'check+end';
  if (ctx.isDraw) return 'gameDraw';
  if (ctx.isCheck) return 'check';
  if (ctx.isCapture) return 'capture';
  if (ctx.isCastle) return 'castle';
  if (ctx.isPromotion) return 'promote';
  return ctx.isPlayer ? 'moveSelf' : 'moveOpponent';
}

describe('sound priority', () => {
  it('prefers checkmate over capture', () => {
    expect(
      pickSound({
        isPlayer: true,
        isCapture: true,
        isCastle: false,
        isPromotion: false,
        isCheck: true,
        isCheckmate: true,
        isDraw: false,
      })
    ).toBe('check+end');
  });

  it('prefers capture over normal', () => {
    expect(
      pickSound({
        isPlayer: false,
        isCapture: true,
        isCastle: false,
        isPromotion: false,
        isCheck: false,
        isCheckmate: false,
        isDraw: false,
      })
    ).toBe('capture');
  });

  it('uses opponent sound for AI moves', () => {
    expect(
      pickSound({
        isPlayer: false,
        isCapture: false,
        isCastle: false,
        isPromotion: false,
        isCheck: false,
        isCheckmate: false,
        isDraw: false,
      })
    ).toBe('moveOpponent');
  });
});
