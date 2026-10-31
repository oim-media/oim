/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * El trazado sobre el que corre un texto artistico curvado.
 *
 * Vive aqui por el mismo motivo que `typography.ts` y `fill.ts`: estaba
 * escrito DOS VECES —una en el editor, otra en el player— y las dos copias
 * habian divergido en las dos formas que el editor ofrece:
 *
 *   arco: el control quedaba un 80% mas alto en el player, y sus extremos
 *         4 px por encima de los del editor.
 *   onda: la amplitud del editor era un 29% mayor.
 *
 * Se conserva la geometria del EDITOR, no la del player, y no por antiguedad:
 * la del editor mantiene el arco centrado en la caja —el vertice sube
 * `deltaY/4` y los extremos bajan `deltaY/2`—, mientras que la del player
 * anclaba los extremos a la linea base y empujaba el vertice hacia arriba.
 * Con la curva al maximo eso dejaba el texto a 11 px del borde superior de
 * una caja de 120: recortado.
 *
 * Que se copiara y luego divergiera no es casualidad. La extrusion 3D se
 * copio tambien y sigue identica; la curva es lo que alguien retoca «para que
 * se vea mejor», y se retoca en UN lado.
 */

/** Las formas de trazado. `arch` no la ofrece el editor; se acepta y se
 *  trata como arco, que es lo que ya hacia. */
export type TextCurveType = "arc" | "wave" | "arch";

/**
 * Devuelve el atributo `d` del trazado que sigue el texto.
 *
 * @param width  ancho de la caja, en px
 * @param height alto de la caja, en px
 * @param curveAmount curvatura de -100 a 100; 0 es una recta
 * @param curveType forma del trazado
 */
export function calculateTextCurvePath(
  width: number,
  height: number,
  curveAmount: number,
  curveType: TextCurveType = "arc"
): string {
  const midY = height / 2;
  const clampedCurve = Math.max(-100, Math.min(100, curveAmount));

  if (clampedCurve === 0) {
    return `M 0 ${midY} L ${width} ${midY}`;
  }

  // Desplazamiento vertical maximo proporcional a la altura y curvatura
  const maxDelta = height * 0.45;
  const deltaY = (clampedCurve / 100) * maxDelta;

  if (curveType === "wave") {
    // Onda cubica senoidal
    const cp1x = width * 0.25;
    const cp1y = midY - deltaY;
    const cp2x = width * 0.75;
    const cp2y = midY + deltaY;
    return `M 0 ${midY} C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${width} ${midY}`;
  }

  // Arco cuadratico
  const yStartEnd = midY + deltaY * 0.5;
  const yControl = midY - deltaY;

  return `M 0 ${yStartEnd} Q ${width / 2} ${yControl} ${width} ${yStartEnd}`;
}

/** One line of artistic text, placed around the vertical centre of its box. */
export interface ArtisticTextLine {
  text: string;
  /** Distance in px from the box's vertical centre to this line's centre. */
  offset: number;
}

/**
 * Splits artistic text into lines and centres the block vertically.
 *
 * An SVG `<text>` does not break lines: it paints "\n" as a space, which is
 * why pressing Enter in 3D/vector text did nothing. Each line is drawn on its
 * own, `offset` px from the centre. It lives here, shared, so the editor and
 * the player stack lines the same way.
 */
export function artisticTextLines(text: string, fontSize: number, lineHeight: number): ArtisticTextLine[] {
  const lines = String(text ?? "").split(/\r\n|\r|\n/);
  const step = fontSize * lineHeight;
  const middle = (lines.length - 1) / 2;
  return lines.map((line, i) => ({ text: line, offset: (i - middle) * step }));
}
