import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { SOUND_FILES } from '../audio/soundCatalog';

const SOUND_DIR = resolve(__dirname, '..', '..', 'public', 'sounds');

interface WavInfo {
  channels: number;
  sampleRate: number;
  bitsPerSample: number;
  frames: number;
  rms: number;
}

function readWav(path: string): WavInfo {
  const buffer = readFileSync(path);
  expect(buffer.toString('ascii', 0, 4)).toBe('RIFF');
  expect(buffer.toString('ascii', 8, 12)).toBe('WAVE');
  const channels = buffer.readUInt16LE(22);
  const sampleRate = buffer.readUInt32LE(24);
  const bitsPerSample = buffer.readUInt16LE(34);
  const dataSize = buffer.readUInt32LE(40);
  const frames = dataSize / (channels * (bitsPerSample / 8));
  let sum = 0;
  for (let i = 0; i < frames; i++) {
    const sample = buffer.readInt16LE(44 + i * 2) / 32768;
    sum += sample * sample;
  }
  return { channels, sampleRate, bitsPerSample, frames, rms: Math.sqrt(sum / Math.max(1, frames)) };
}

describe('bundled sound files', () => {
  const files = readdirSync(SOUND_DIR).filter((f) => f.endsWith('.wav'));

  it('ships every file the catalog references', () => {
    for (const [id, file] of Object.entries(SOUND_FILES)) {
      expect(files, `${id} -> ${file} is missing from public/sounds`).toContain(file);
    }
  });

  it('does not ship files the catalog never plays', () => {
    const referenced = new Set(Object.values(SOUND_FILES));
    for (const file of files) {
      expect(referenced.has(file), `${file} is not referenced by SOUND_FILES`).toBe(true);
    }
  });

  it('every file is a real, audible 44.1 kHz mono clip', () => {
    for (const file of files) {
      const info = readWav(resolve(SOUND_DIR, file));
      expect(info.channels, `${file} channels`).toBe(1);
      expect(info.sampleRate, `${file} sample rate`).toBe(44100);
      expect(info.bitsPerSample, `${file} bit depth`).toBe(16);
      expect(info.frames / 44100, `${file} duration`).toBeGreaterThan(0.02);
      // A silent file would mean a broken generator, which is exactly the bug
      // that made move sounds unreliable before.
      expect(info.rms, `${file} is silent`).toBeGreaterThan(0.01);
    }
  });

  it('keeps ordinary move sounds short so they never overlap play', () => {
    const moveFiles = ['move-self.wav', 'move-opponent.wav', 'capture.wav', 'castle.wav', 'premove.wav'];
    for (const file of moveFiles) {
      const info = readWav(resolve(SOUND_DIR, file));
      expect(info.frames / 44100, `${file} is too long`).toBeLessThan(0.5);
    }
  });
});
