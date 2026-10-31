import { describe, it, expect } from 'vitest';
import { resolveBackgroundFit } from './ImageEngine';

/**
 * The editor↔player contract for the background: the editor bakes an SVG and
 * the player paints it. The only decision the player makes on its own is
 * whether that SVG repeats as a tile or covers the entire canvas.
 *
 * Getting it wrong toward 'cover' breaks every .oim already published (icon
 * patterns would stop repeating); getting it wrong toward 'tile' turns a
 * generative scene into a distorted mosaic.
 */
describe('resolveBackgroundFit', () => {
  it('defaults to tile so already-published .oim files keep repeating', () => {
    expect(resolveBackgroundFit({ svgRawXml: '<svg/>' })).toBe('tile');
    expect(resolveBackgroundFit({ backgroundType: 'pattern' })).toBe('tile');
  });

  it('honours an explicit backgroundFit written by the editor', () => {
    expect(resolveBackgroundFit({ backgroundFit: 'cover' })).toBe('cover');
    expect(resolveBackgroundFit({ backgroundFit: 'tile' })).toBe('tile');
  });

  it('explicit tile wins over a generative backgroundType', () => {
    expect(
      resolveBackgroundFit({ backgroundFit: 'tile', backgroundType: 'generative' })
    ).toBe('tile');
  });

  it('infers cover for generative backgrounds baked before the field existed', () => {
    expect(resolveBackgroundFit({ backgroundType: 'generative' })).toBe('cover');
  });

  it('ignores an unknown backgroundFit instead of trusting it', () => {
    expect(resolveBackgroundFit({ backgroundFit: 'contain' as any })).toBe('tile');
    expect(
      resolveBackgroundFit({ backgroundFit: 'nonsense' as any, backgroundType: 'generative' })
    ).toBe('cover');
  });

  it('survives a missing style object', () => {
    expect(resolveBackgroundFit(undefined)).toBe('tile');
    expect(resolveBackgroundFit(null)).toBe('tile');
  });
});
