// @vitest-environment happy-dom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ParallaxController } from './ParallaxController';

describe('ParallaxController', () => {
  let container: HTMLElement;
  let element: HTMLElement;
  let controller: ParallaxController;

  beforeEach(() => {
    container = document.createElement('div');
    element = document.createElement('div');
    container.appendChild(element);
    document.body.appendChild(container);
  });

  afterEach(() => {
    if (controller) {
      controller.destroy();
    }
    document.body.removeChild(container);
  });

  it('instantiates and registers slot items without errors', () => {
    controller = new ParallaxController(container);
    controller.registerSlot({
      id: 'test-slot',
      element,
      depth: 0.5,
      mode: 'mouse',
      axis: 'both',
    });
    expect(controller).toBeDefined();
  });

  it('cleans up event listeners and animation frame on destroy', () => {
    controller = new ParallaxController(container);
    const cancelSpy = vi.spyOn(window, 'cancelAnimationFrame');
    controller.destroy();
    expect(cancelSpy).toHaveBeenCalled();
  });

  it('pauses and resumes rAF loop on pause() and play()', () => {
    controller = new ParallaxController(container);
    controller.registerSlot({
      id: 'test-slot',
      element,
      depth: 0.5,
      mode: 'mouse',
      axis: 'both',
    });

    const cancelSpy = vi.spyOn(window, 'cancelAnimationFrame');
    controller.pause();
    expect(cancelSpy).toHaveBeenCalled();

    const reqSpy = vi.spyOn(window, 'requestAnimationFrame');
    controller.play();
    expect(reqSpy).toHaveBeenCalled();
  });
});
