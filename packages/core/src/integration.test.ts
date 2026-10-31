import { describe, it, expect } from 'vitest';
import { OimMetadataSchema } from './schema';
import { compressAndEncodeJSON, extractOIM } from './binary';

/**
 * Round-trip del formato: validar -> comprimir -> incrustar en el chunk tEXt
 * -> extraer -> decodificar.
 *
 * Antes este test empezaba llamando a `mapLayersToOimSlots`, el compilador de
 * medidas que vivía en `./serialize`. Se eliminó por emitir un dialecto
 * distinto al del backend (anclaba la posición al centro del slot), así que
 * los slots de entrada son ahora un fixture literal en el formato REAL: el
 * que produce `POST /v1/oim/compile` y el que lee el player.
 *
 * Que sea un fixture y no una función es deliberado — así el test fija el
 * contrato del archivo, no la implementación de quien lo escribe.
 */
describe('Integration Flow: Package -> Play', () => {
  const pngHeader = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

  function buildMockPng(type: string, data: Uint8Array): Blob {
    const totalLen = 8 + 4 + 4 + data.length + 4;
    const buf = new ArrayBuffer(totalLen);
    const view = new DataView(buf);
    const bytes = new Uint8Array(buf);

    bytes.set(pngHeader, 0);
    view.setUint32(8, data.length, false);
    for (let i = 0; i < 4; i++) {
      view.setUint8(12 + i, type.charCodeAt(i));
    }
    bytes.set(data, 16);
    view.setUint32(16 + data.length, 0, false);
    return new Blob([buf]);
  }

  it('validates, encodes into PNG, extracts and decodes without losing fields', async () => {
    // Slot tal y como lo emite el compilador del backend para un lienzo de
    // 1000x1000: posición en porcentaje del lienzo, medidas en `cqw`
    // (proporcionales al ANCHO), y `width_px`/`height_px` con el crudo.
    const slots = [
      {
        id: 'header-slot',
        type: 'text' as const,
        align: 'center' as const,
        position: [10, 5] as [number, number],
        width_px: 800,
        height_px: 100,
        content: {
          en: 'Main Title',
          es: 'Título Principal',
          fr: 'Titre Principal'
        },
        style: {
          color: '#ffffff',
          fontSize: '3.2000cqw',
          width: '80.0000cqw',
          height: '10.0000cqw'
        }
      }
    ];

    const metadata = {
      version: '1.0',
      lang: ['es', 'en', 'fr'],
      slots
    };

    const validation = OimMetadataSchema.safeParse(metadata);
    expect(validation.success).toBe(true);

    const encodedDataString = await compressAndEncodeJSON(metadata);
    const keywordBytes = new TextEncoder().encode('OIM_Data');
    const valueBytes = new TextEncoder().encode(encodedDataString);
    const chunkData = new Uint8Array(keywordBytes.length + 1 + valueBytes.length);
    chunkData.set(keywordBytes, 0);
    chunkData[keywordBytes.length] = 0;
    chunkData.set(valueBytes, keywordBytes.length + 1);

    const mockOimPng = buildMockPng('tEXt', chunkData);

    const extracted = await extractOIM(mockOimPng);
    expect(extracted.metadata).toBeDefined();

    const finalSlots = extracted.metadata?.slots;
    expect(finalSlots).toHaveLength(1);
    expect(finalSlots?.[0].id).toBe('header-slot');
    expect(finalSlots?.[0].content?.en).toBe('Main Title');
    expect(finalSlots?.[0].content?.es).toBe('Título Principal');

    // La geometría es lo que el player necesita para situar la capa, y es
    // justo lo que se perdía cuando el .oim llegaba en el otro dialecto.
    expect(finalSlots?.[0].position).toEqual([10, 5]);
    expect(finalSlots?.[0].width_px).toBe(800);
    expect(finalSlots?.[0].style?.fontSize).toBe('3.2000cqw');
  });
});
