// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { copyText, downloadText } from '../chess/pgnExport';

afterEach(() => {
  vi.useRealTimers();
});

describe('copyText', () => {
  it('uses the async clipboard when it is available', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    await expect(copyText('1. e4 e5 *', { clipboard: { writeText }, document: null })).resolves.toBe(true);
    expect(writeText).toHaveBeenCalledWith('1. e4 e5 *');
  });

  it('reports failure when the clipboard rejects and no fallback exists', async () => {
    const writeText = vi.fn().mockRejectedValue(new Error('denied'));
    await expect(copyText('pgn', { clipboard: { writeText }, document: null })).resolves.toBe(false);
  });

  it('falls back to a temporary textarea when the clipboard is blocked', async () => {
    const area = document.createElement('textarea');
    const execCommand = vi.fn().mockReturnValue(true);
    const doc = {
      createElement: () => area,
      body: { appendChild: vi.fn(), removeChild: vi.fn() },
      execCommand,
    } as unknown as Document;
    const ok = await copyText('fallback text', {
      clipboard: { writeText: vi.fn().mockRejectedValue(new Error('denied')) },
      document: doc,
    });
    expect(ok).toBe(true);
    expect(execCommand).toHaveBeenCalledWith('copy');
    expect(doc.body.appendChild).toHaveBeenCalled();
    expect(doc.body.removeChild).toHaveBeenCalled();
  });

  it('reports failure when there is no clipboard at all', async () => {
    await expect(copyText('pgn', { clipboard: null, document: null })).resolves.toBe(false);
  });
});

describe('downloadText', () => {
  it('downloads the file under the given name', () => {
    vi.useFakeTimers();
    const clicked: string[] = [];
    const anchors: { download?: string; href?: string }[] = [];
    const revoke = vi.fn();
    const doc = {
      createElement: () => {
        const anchor = {
          download: '',
          href: '',
          click: () => clicked.push(`${anchor.download}`),
        };
        anchors.push(anchor);
        return anchor;
      },
      body: { appendChild: vi.fn(), removeChild: vi.fn() },
    } as unknown as Document;
    const url = { createObjectURL: () => 'blob:fake', revokeObjectURL: revoke };

    const name = downloadText('aichess-game-2026-10-11.pgn', '1. e4 *', {
      document: doc,
      url,
      BlobCtor: Blob,
    });

    expect(name).toBe('aichess-game-2026-10-11.pgn');
    expect(clicked).toEqual(['aichess-game-2026-10-11.pgn']);
    expect(anchors[0].href).toBe('blob:fake');
    // The object URL is released, but only after the download starts.
    expect(revoke).not.toHaveBeenCalled();
    vi.runAllTimers();
    expect(revoke).toHaveBeenCalledWith('blob:fake');
  });

  it('does nothing without a document', () => {
    expect(downloadText('x.pgn', 'text', { document: null })).toBeNull();
  });
});
