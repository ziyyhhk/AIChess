/**
 * Copying and downloading text (used by the PGN export buttons).
 *
 * Both helpers are written so the browser-specific parts can be injected in
 * tests, and so the caller only reports success once the clipboard really held
 * the text.
 */

export interface ClipboardEnv {
  clipboard?: { writeText?: (text: string) => Promise<void> } | null;
  document?: Document | null;
}

/** Copies text to the clipboard. Returns false when nothing could be copied. */
export async function copyText(text: string, env: ClipboardEnv = {}): Promise<boolean> {
  const clipboard =
    env.clipboard !== undefined
      ? env.clipboard
      : typeof navigator !== 'undefined'
        ? navigator.clipboard
        : null;
  if (clipboard?.writeText) {
    try {
      await clipboard.writeText(text);
      return true;
    } catch {
      /* fall through to the textarea trick */
    }
  }

  const doc = env.document !== undefined ? env.document : typeof document !== 'undefined' ? document : null;
  if (!doc || typeof doc.execCommand !== 'function') return false;
  try {
    const area = doc.createElement('textarea');
    area.value = text;
    area.setAttribute('readonly', 'readonly');
    area.style.position = 'fixed';
    area.style.left = '-9999px';
    doc.body.appendChild(area);
    area.select();
    const ok = doc.execCommand('copy');
    doc.body.removeChild(area);
    return ok;
  } catch {
    return false;
  }
}

export interface DownloadEnv {
  document?: Document | null;
  url?: { createObjectURL(blob: Blob): string; revokeObjectURL(url: string): void } | null;
  BlobCtor?: typeof Blob;
}

/** Downloads text as a file. Returns the file name that was used. */
export function downloadText(
  filename: string,
  text: string,
  env: DownloadEnv = {}
): string | null {
  const doc = env.document !== undefined ? env.document : typeof document !== 'undefined' ? document : null;
  if (!doc) return null;
  const urlApi =
    env.url !== undefined
      ? env.url
      : typeof URL !== 'undefined' && typeof URL.createObjectURL === 'function'
        ? URL
        : null;
  const BlobImpl = env.BlobCtor ?? (typeof Blob !== 'undefined' ? Blob : undefined);
  if (!urlApi || !BlobImpl) return null;

  const blob = new BlobImpl([text], { type: 'application/x-chess-pgn;charset=utf-8' });
  const url = urlApi.createObjectURL(blob);
  const anchor = doc.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  doc.body.appendChild(anchor);
  anchor.click();
  doc.body.removeChild(anchor);
  // Revoke later so the download has time to start.
  setTimeout(() => urlApi.revokeObjectURL(url), 1000);
  return filename;
}
