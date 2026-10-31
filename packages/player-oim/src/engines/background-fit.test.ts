import { describe, it, expect } from 'vitest';
import { resolveBackgroundFit } from './ImageEngine';

/**
 * El contrato editor↔player para el fondo: el editor hornea un SVG y el player
 * lo pinta. La única decisión que el player toma por su cuenta es si ese SVG se
 * repite como mosaico o cubre el lienzo entero.
 *
 * Equivocarse hacia 'cover' rompe todos los .oim ya publicados (patrones de
 * íconos que dejarían de repetirse); equivocarse hacia 'tile' convierte una
 * escena generativa en un mosaico deformado.
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
