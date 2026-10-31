import './core/own-script.js';
import { resolveMode } from './core/modes.js';
import { ImageEngine } from './engines/ImageEngine.js';
import { fileCache } from './core/file-cache.js';

interface OimPlayerOptions {
  allowZoom?: boolean;
  showLanguageSelector?: boolean;
  showSlots?: boolean;
  allowLottie?: boolean;
  disableAnimations?: boolean;
  dropdownBlur?: boolean;
  fit?: 'contain' | 'cover';
  align?: 'center' | 'top' | 'bottom';
}

function detectMediaType(src: Blob | string, firstBytes: Uint8Array | null): 'image' | 'video' {
  let ext = '';
  if (typeof src === 'string') {
    const hashIdx = src.indexOf('#');
    const queryIdx = src.indexOf('?');
    const endIdx = hashIdx !== -1 ? hashIdx : (queryIdx !== -1 ? queryIdx : src.length);
    const dotIdx = src.lastIndexOf('.', endIdx);
    if (dotIdx !== -1) {
      ext = src.substring(dotIdx + 1, endIdx).toLowerCase();
    }
  } else if (src && (src as any).name) {
    const name = (src as any).name;
    const dotIdx = name.lastIndexOf('.');
    if (dotIdx !== -1) {
      ext = name.substring(dotIdx + 1).toLowerCase();
    }
  }

  if (ext === 'oim' || ext === 'png') {
    return 'image';
  }
  if (ext === 'ovm' || ext === 'webm' || ext === 'mp4' || ext === 'mkv') {
    return 'video';
  }

  if (firstBytes) {
    const magic = String.fromCharCode(firstBytes[0], firstBytes[1], firstBytes[2], firstBytes[3]);
    if (magic === '\x89PNG') return 'image';
    if (magic === 'OVM\x00' || magic === '\x1aE\xdf\xa3') return 'video';
  }

  return 'image';
}

const OimPlayerElement = Object.create(HTMLElement.prototype);

/**
 * Un `<oim-player>` sin cargar no ocupa NADA.
 *
 * Es un elemento a medida: por defecto es `display: inline` y sin content.
 * En una lista, los contenedores vacios colapsan sus margenes en uno solo y
 * TODOS los players quedan apilados en el mismo pixel. Medido con 24 en un
 * feed: los 24 reportaban `top: 700` y por tanto los 24 estaban "a la vista",
 * asi que los 24 se cargaban. La carga perezosa no puede funcionar si el hueco
 * no existe todavia.
 *
 * Se reserva sitio hasta que el motor pone `data-oim-cargado`, y NO se usa la
 * clase `oim-player-host`: esa se añade en `connectedCallback`, antes de
 * cargar nada, asi que como señal de "ya tiene content" no vale -se probó y
 * el hueco no llegaba a reservarse nunca-.
 *
 * Con `:where()` para especificidad CERO: cualquier regla del autor gana sin
 * tener que pelear.
 */
function ensureReservedSpace(): void {
  if (typeof document === 'undefined') return;
  if (document.getElementById('oim-player-hueco')) return;
  const est = document.createElement('style');
  est.id = 'oim-player-hueco';
  est.textContent =
    ':where(oim-player){display:block}' +
    ':where(oim-player:not([data-oim-cargado])){min-height:200px}';
  (document.head || document.documentElement).appendChild(est);
}

OimPlayerElement.connectedCallback = function (this: any) {
  ensureReservedSpace();
  this.classList.add('oim-player-host');
  this._engine = null;
  this._src = this.getAttribute('src');
  
  if (!this._oimOptions) this._oimOptions = {};
  if (this.hasAttribute('fit')) this._oimOptions.fit = this.getAttribute('fit');
  if (this.hasAttribute('align')) this._oimOptions.align = this.getAttribute('align');
  if (this.hasAttribute('dropdown-blur')) this._oimOptions.dropdownBlur = this.getAttribute('dropdown-blur') !== 'false';
  if (this.hasAttribute('allow-lottie')) this._oimOptions.allowLottie = this.getAttribute('allow-lottie') !== 'false';
  if (this.hasAttribute('allow-dynamic-colors')) this._oimOptions.allowDynamicColors = this.getAttribute('allow-dynamic-colors') !== 'false';
  if (this.hasAttribute('placeholder')) this._oimOptions.placeholder = this.getAttribute('placeholder');
  if (this.hasAttribute('allow-zoom')) this._oimOptions.allowZoom = this.getAttribute('allow-zoom') === 'true';

  // Dark/light del sistema: en vivo, sin recargar. Se quita en disconnectedCallback.
  this._mqOscuro = typeof matchMedia === 'function' ? matchMedia('(prefers-color-scheme: dark)') : null;
  this._onEsquema = () => this._engine && this._engine.aplicarPaleta();
  if (this._mqOscuro) this._mqOscuro.addEventListener('change', this._onEsquema);

  this._replantearActividad();
};

/**
 * El dueño de "estoy activo".
 *
 * Antes habia TRES mecanismos rozando la idea -el observador, `pause()` y la
 * clase `oim-player-paused`- y ninguno mandaba sobre los otros: cada uno
 * protegia un trozo y nadie protegia el conjunto.
 *
 *   dormido -> ni se descarga
 *   listo   -> descargado y construido, quieto
 *   activo  -> se mueve
 */
OimPlayerElement._replantearActividad = function (this: any) {
  if (!this._src || !this.isConnected) return;

  if (!this._observers) {
    if (!('IntersectionObserver' in window)) {
      // Sin observador no hay forma de saber si se ve: se carga y se anima,
      // que es como se comportaba antes de todo esto.
      this._pasarA('activo');
      return;
    }
    const self = this;
    const fire = () => self._programarDecision();

    // DOS observadores, UNA decision. Al cruzar margenes, guardamos el estado de
    // interseccion para evitar llamar a getBoundingClientRect() de forma sincronica
    // en cada frame durante desplazamientos rapidos a 120Hz.
    this._observers = [
      new IntersectionObserver((entries) => {
        const entry = entries[0];
        if (entry && typeof entry.isIntersecting === 'boolean') {
          self._isNear = entry.isIntersecting;
        }
        fire();
      }, { rootMargin: '200px' }),
      new IntersectionObserver((entries) => {
        const entry = entries[0];
        if (entry && typeof entry.isIntersecting === 'boolean') {
          self._isVisible = entry.isIntersecting;
        }
        fire();
      }, { threshold: [0, 0.01] }),
    ];
    this._observers.forEach((o: IntersectionObserver) => o.observe(this));

    this._onTabChange = fire;
    document.addEventListener('visibilitychange', this._onTabChange);

    if (this.getAttribute('activate-on') === 'hover') {
      this._onPointerEnter = () => { self._hasPointer = true; fire(); };
      this._onPointerLeave = () => { self._hasPointer = false; fire(); };
      this.addEventListener('mouseenter', this._onPointerEnter);
      this.addEventListener('mouseleave', this._onPointerLeave);
    }
  }
  this._programarDecision();
};

/**
 * Aplaza la decision al siguiente frame.
 *
 * Al insertar varios players de golpe -`innerHTML` con una lista- hay un
 * instante ANTES de la maquetacion en que todos ocupan el mismo sitio y el
 * observador los reporta a TODOS como visibles. Medido: los 24 pasaban por
 * `dormido > activo > dormido`, y ese `activo` fantasma bastaba para
 * descargarlos enteros.
 */
OimPlayerElement._programarDecision = function (this: any) {
  if (this._activityFrame) return;
  const self = this;
  this._activityFrame = requestAnimationFrame(function () {
    self._activityFrame = null;
    self._decidir();
  });
};

/**
 * Traduce la situacion al estado, y solo aqui.
 *
 * Usa el informe del observador cuando esta disponible para evitar reflows
 * sincronicos durante el desplazamiento; cae a la lectura de getBoundingClientRect()
 * cuando no hay informe (ej. pruebas o inicializacion).
 */
OimPlayerElement._decidir = function (this: any) {
  if (!this._src || !this.isConnected) return;

  const tabHidden = typeof document !== 'undefined' && document.visibilityState === 'hidden';
  let near: boolean;
  let moves: boolean;

  if (typeof this._isNear === 'boolean' || typeof this._isVisible === 'boolean') {
    near = this._isNear ?? false;
    const visible = this._isVisible ?? false;
    moves = (near || visible) && visible && !tabHidden;
    near = near || visible;
  } else {
    const r = this.getBoundingClientRect();
    const height = window.innerHeight || 0;
    const MARGIN = 200;

    near = r.bottom > -MARGIN && r.top < height + MARGIN;
    moves = near && !tabHidden && r.bottom > 0 && r.top < height;
  }

  if (this.getAttribute('activate-on') === 'hover') {
    // En tactil no hay cursor: `hover` se comporta como `visible`, o el archivo
    // no se moveria NUNCA en un movil.
    const hasPointer = typeof matchMedia === 'function' && matchMedia('(hover: hover)').matches;
    if (hasPointer) moves = moves && !!this._hasPointer;
  }

  // `manual`: the page decides when it moves (play()/pause()), e.g. a
  // carousel that only animates its centred card. Visibility still decides
  // when to build it, never when to play it.
  if (this.getAttribute('activate-on') === 'manual') moves = false;

  this._pasarA(moves ? 'activo' : (near ? 'listo' : 'dormido'));
};

OimPlayerElement._pasarA = function (this: any, state: string) {
  if (this._activityState === state) return;
  this._activityState = state;

  if (state === 'dormido') return;   // nada que construir ni que parar
  if (!this._engine) this._initPlayer();
  if (state === 'activo') this.play();
  else this.pause();
};

OimPlayerElement._startAutoRotateLang = function (this: any) {
  this._stopAutoRotateLang();
  
  const autoRotate = this.getAttribute('auto-rotate-lang');
  if (!autoRotate || autoRotate === 'false') return;
  // A paused player does not rotate: every switch repaints its layers. The
  // end of loading and the attribute both land here; play() starts it.
  if (this.classList.contains('oim-player-paused')) return;
  
  let intervalMs = parseInt(autoRotate, 10);
  if (isNaN(intervalMs) || intervalMs <= 0) {
    intervalMs = 3000; 
  }
  
  const self = this;
  this._autoRotateIntervalId = setInterval(() => {
    const metadata = self.getMetadata();
    if (!metadata) return;
    
    const slots = metadata.slots || metadata.elements || [];
    const allLangs: Record<string, boolean> = {};
    for (let i = 0; i < slots.length; i++) {
      const content = slots[i].content || {};
      Object.keys(content).forEach((lang) => {
        allLangs[lang.toLowerCase()] = true;
      });
    }
    const langs = Object.keys(allLangs).sort();
    if (langs.length <= 1) return;
    
    const currentLang = (self.getAttribute('lang') || (self._engine && self._engine.lang) || 'es').toLowerCase();
    const idx = langs.indexOf(currentLang);
    const nextIdx = (idx + 1) % langs.length;
    const nextLang = langs[nextIdx];
    
    self.setAttribute('lang', nextLang);
  }, intervalMs);
};

OimPlayerElement._stopAutoRotateLang = function (this: any) {
  if (this._autoRotateIntervalId) {
    clearInterval(this._autoRotateIntervalId);
    this._autoRotateIntervalId = null;
  }
};

OimPlayerElement.disconnectedCallback = function (this: any) {
  if (this._mqOscuro) {
    this._mqOscuro.removeEventListener('change', this._onEsquema);
    this._mqOscuro = null;
  }
  this._stopAutoRotateLang();
  if (this._observers) {
    this._observers.forEach((o: IntersectionObserver) => o.disconnect());
    this._observers = null;
  }
  if (this._onTabChange) {
    document.removeEventListener('visibilitychange', this._onTabChange);
    this._onTabChange = null;
  }
  if (this._onPointerEnter) {
    this.removeEventListener('mouseenter', this._onPointerEnter);
    this.removeEventListener('mouseleave', this._onPointerLeave);
    this._onPointerEnter = null;
    this._onPointerLeave = null;
  }
  if (this._activityFrame) {
    cancelAnimationFrame(this._activityFrame);
    this._activityFrame = null;
  }
  this._isNear = null;
  this._isVisible = null;
  this._activityState = 'dormido';
  if (this._engine && this._engine.destroy) {
    this._engine.destroy();
  }
};

OimPlayerElement.attributeChangedCallback = function (this: any, name: string, oldVal: string, newVal: string) {
  if (name === 'placeholder' && oldVal !== newVal) {
    if (!this._oimOptions) this._oimOptions = {};
    this._oimOptions.placeholder = newVal;
  } else if (name === 'palette' && oldVal !== newVal) {
    if (this._engine) this._engine.aplicarPaleta();
  } else if (name === 'src' && oldVal !== newVal) {
    // NO se llama a `_initPlayer()` aqui, y es el arreglo entero.
    //
    // Esta funcion se dispara al parsear `<oim-player src="...">`, ANTES de
    // `connectedCallback`, asi que el motor quedaba creado antes de que el
    // `IntersectionObserver` existiera: la carga perezosa no se usaba nunca.
    // Medido el 21 de agosto con 12 players y 1 visible: 12 motores.
    this._src = newVal;
    if (this._engine) {
      // Cambiar el `src` de un player YA cargado si recarga: quien lo cambia
      // esta pidiendo ver otra cosa, no montando una lista.
      this._initPlayer();
    } else {
      this._replantearActividad();
    }
  } else if (name === 'activate-on' && oldVal !== newVal) {
    this._replantearActividad();
  } else if (name === 'lang' && oldVal !== newVal) {
    // Por el motor, NO por `setLang()` publico: ese despierta al player, y
    // `<oim-player src lang="es">` es la forma normal de escribirlo. Pasar por
    // el metodo publico aqui hacia que los 24 de una lista se cargaran igual
    // -medido en el navegador: 23 dormidos y 24 con motor-.
    //
    // Un ATRIBUTO es configuracion; una llamada de JS es una peticion. Solo la
    // segunda justifica una descarga que nadie ha visto. Si el motor no existe
    // todavia, `_initPlayer` ya lee el atributo `lang` al construirlo.
    if (this._engine && this._engine.setLang) this._engine.setLang(newVal);
  } else if ((name === 'fit' || name === 'align') && oldVal !== newVal) {
    if (!this._oimOptions) this._oimOptions = {};
    this._oimOptions[name] = newVal;
    this._initPlayer();
  } else if (name === 'dropdown-blur' && oldVal !== newVal) {
    if (!this._oimOptions) this._oimOptions = {};
    this._oimOptions.dropdownBlur = newVal !== 'false';
    if (this._engine) {
      this._engine.dropdownBlur = newVal !== 'false';
    }
  } else if (name === 'allow-lottie' && oldVal !== newVal) {
    if (!this._oimOptions) this._oimOptions = {};
    this._oimOptions.allowLottie = newVal !== 'false';
    if (this._engine) {
      this._engine.allowLottie = newVal !== 'false';
      if (this._engine.renderSlots) this._engine.renderSlots();
    }
  } else if (name === 'auto-rotate-lang' && oldVal !== newVal) {
    this._startAutoRotateLang();
  } else if ((name === 'mode' || name === 'disable-animations' || name === 'disable-actions') && oldVal !== newVal) {
    // Los tres cambian lo mismo, asi que se resuelven juntos y por el MISMO
    // camino que al construir. Resolver aqui a mano -«este atributo vale
    // true»- ignoraba la precedencia: `mode` dejaba de mandar en cuanto se
    // tocaba un atributo suelto una sola vez.
    if (this._engine) {
      const reducedMotion = typeof window !== 'undefined' && window.matchMedia
        && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      const mode = resolveMode(this, this._oimOptions || {}, !!reducedMotion);
      this._engine.disableAnimations = mode.disableAnimations;
      this._engine.disableActions = mode.disableActions;
      if (this._engine.renderSlots) this._engine.renderSlots();
    }
  } else if (name === 'show-slots' && oldVal !== newVal) {
    if (!this._oimOptions) this._oimOptions = {};
    this._oimOptions.showSlots = newVal !== 'false';
    if (this._engine) {
      this._engine.showSlots = newVal !== 'false';
      if (this._engine.renderSlots) this._engine.renderSlots();
    }
  }
};

OimPlayerElement._initPlayer = function (this: any) {
  if (!this._src) return;
  this._loading = true;

  const self = this;
  const src = this._src;

  if (!self._oimOptions) self._oimOptions = {};
  if (self.hasAttribute('fit')) self._oimOptions.fit = self.getAttribute('fit');
  if (self.hasAttribute('align')) self._oimOptions.align = self.getAttribute('align');
  if (self.hasAttribute('dropdown-blur')) self._oimOptions.dropdownBlur = self.getAttribute('dropdown-blur') !== 'false';
  if (self.hasAttribute('placeholder')) self._oimOptions.placeholder = self.getAttribute('placeholder');
  if (self.hasAttribute('allow-lottie')) self._oimOptions.allowLottie = self.getAttribute('allow-lottie') !== 'false';
  if (self.hasAttribute('allow-zoom')) self._oimOptions.allowZoom = self.getAttribute('allow-zoom') === 'true';

  let bytesPromise: Promise<Uint8Array | null>;
  if (src instanceof Blob) {
    bytesPromise = src.slice(0, 16).arrayBuffer()
      .then((buf) => new Uint8Array(buf))
      .catch(() => null);
  } else {
    // The previous HEAD + Range sniff cost two requests, and a whole second
    // download on hosts that ignore Range. Sniffing from the shared cache
    // reads 16 bytes of the single download with zero extra HTTP requests.
    bytesPromise = fileCache.sniff(src);
  }

  bytesPromise.then((firstBytes) => {
    if (!self.isConnected) return;

    const mediaType = detectMediaType(src, firstBytes);

    if (self._engine && self._engine.destroy) {
      self._engine.destroy();
    }

    if (mediaType === 'video') {
      console.warn('[OimPlayer] Video media detected. Video support has been migrated to <ovm-player> from @oim-media/player-ovm. Falling back to ImageEngine.');
    }
    
    self._engine = new ImageEngine(self, self._oimOptions);
    self._loading = false;
    // `_pasarA` calls `pause()` right after `_initPlayer()`, before this
    // engine exists, so that pause only reached the CSS class. The engine
    // inherits it here, or its Lottie and keyframes play on a card that is
    // waiting for the cursor.
    if (self.classList.contains('oim-player-paused')) self._engine.pause();
    self.setAttribute('data-oim-cargado', '');

    self._engine.load(src).then(() => {
      self._startAutoRotateLang();
    }).catch((err: any) => {
      console.warn('[OimPlayer] Engine load error during auto-rotate initialization:', err);
    });
  });
};

/**
 * Despierta al player si nadie lo habia hecho.
 *
 * La carga perezosa elimina la descarga que NADIE pidio. Una llamada a la API
 * SI la pide: sin esto, `getMetadata()` sobre un `.oim` al fondo de una lista
 * devolveria `null` donde antes devolvia datos, y romperiamos a quien la use.
 */
OimPlayerElement._despertar = function (this: any) {
  // `_loading` y no solo `_engine`: `_initPlayer` tarda en asignar el motor,
  // asi que `_pasarA` lo llamaba y acto seguido `play()` -> `_despertar()` lo
  // llamaba OTRA VEZ. Medido: dos cargas y el doble de peticiones por player.
  if (this._engine || this._loading || !this._src) return;
  this._initPlayer();
};

OimPlayerElement.getMetadata = function (this: any) {
  this._despertar();
  return this._engine ? this._engine.metadata : null;
};

OimPlayerElement.getSecurityStatus = function (this: any) {
  this._despertar();
  return this._engine ? (this._engine.securityStatus || 'unsigned') : null;
};

OimPlayerElement.setLang = function (this: any, lang: string) {
  this._despertar();
  if (this._engine && this._engine.setLang) {
    this._engine.setLang(lang);
  }
};

OimPlayerElement.setZoom = function (this: any, zoom: number) {
  if (this._engine && this._engine.setZoom) {
    this._engine.setZoom(zoom);
  }
};

OimPlayerElement.play = function (this: any) {
  this._despertar();
  this.classList.remove('oim-player-paused');
  if (this._engine && this._engine.play) {
    this._engine.play();
  }
  this._startAutoRotateLang();
};

OimPlayerElement.pause = function (this: any) {
  this.classList.add('oim-player-paused');
  if (this._engine && this._engine.pause) {
    this._engine.pause();
  }
  this._stopAutoRotateLang();
};

OimPlayerElement.seek = function (this: any, time: number) {
  if (this._engine && this._engine.seek) {
    this._engine.seek(time);
  }
};

OimPlayerElement.getEngine = function (this: any) {
  return this._engine;
};

OimPlayerElement.destroy = function (this: any) {
  if (this._engine && this._engine.destroy) {
    this._engine.destroy();
    this._engine = null;
  }
  if (this.parentNode) {
    this.parentNode.removeChild(this);
  }
};

const observedAttrs = ['src', 'placeholder', 'lang', 'activate-on', 'fit', 'align', 'dropdown-blur', 'allow-lottie', 'palette', 'auto-rotate-lang', 'disable-animations', 'disable-actions', 'mode', 'show-slots'];

let OimPlayerClass: any;

if (typeof customElements !== 'undefined' && !customElements.get('oim-player')) {
  OimPlayerClass = function (this: any) {
    const el = Reflect.construct(HTMLElement, [], OimPlayerClass) as any;
    el._engine = null;
    el._src = null;
    return el;
  };
  OimPlayerClass.prototype = Object.create(HTMLElement.prototype);
  OimPlayerClass.prototype.connectedCallback = OimPlayerElement.connectedCallback;
  OimPlayerClass.prototype.disconnectedCallback = OimPlayerElement.disconnectedCallback;
  OimPlayerClass.prototype.attributeChangedCallback = OimPlayerElement.attributeChangedCallback;
  OimPlayerClass.prototype.getMetadata = OimPlayerElement.getMetadata;
  OimPlayerClass.prototype.getSecurityStatus = OimPlayerElement.getSecurityStatus;
  OimPlayerClass.prototype.setLang = OimPlayerElement.setLang;
  OimPlayerClass.prototype.setZoom = OimPlayerElement.setZoom;
  OimPlayerClass.prototype.play = OimPlayerElement.play;
  OimPlayerClass.prototype.pause = OimPlayerElement.pause;
  OimPlayerClass.prototype.seek = OimPlayerElement.seek;
  OimPlayerClass.prototype.getEngine = OimPlayerElement.getEngine;
  OimPlayerClass.prototype._initPlayer = OimPlayerElement._initPlayer;
  OimPlayerClass.prototype._replantearActividad = OimPlayerElement._replantearActividad;
  OimPlayerClass.prototype._decidir = OimPlayerElement._decidir;
  OimPlayerClass.prototype._programarDecision = OimPlayerElement._programarDecision;
  OimPlayerClass.prototype._pasarA = OimPlayerElement._pasarA;
  OimPlayerClass.prototype._despertar = OimPlayerElement._despertar;
  OimPlayerClass.prototype._startAutoRotateLang = OimPlayerElement._startAutoRotateLang;
  OimPlayerClass.prototype._stopAutoRotateLang = OimPlayerElement._stopAutoRotateLang;
  OimPlayerClass.prototype.destroy = OimPlayerElement.destroy;
  OimPlayerClass.observedAttributes = observedAttrs;

  Object.defineProperty(OimPlayerClass.prototype, 'src', {
    get: function (this: any) {
      return this._src;
    },
    set: function (this: any, val: any) {
      this._src = val;
      if (typeof val === 'string') {
        this.setAttribute('src', val);
      } else {
        this._initPlayer();
      }
    }
  });

  Object.defineProperty(OimPlayerClass.prototype, 'languages', {
    get: function (this: any) {
      if (!this._engine || !this._engine.metadata) return [];
      const slots = this._engine.metadata.slots || this._engine.metadata.elements || [];
      const allLangs: Record<string, boolean> = {};
      for (let i = 0; i < slots.length; i++) {
        const content = slots[i].content || {};
        Object.keys(content).forEach((lang) => {
          allLangs[lang.toLowerCase()] = true;
        });
      }
      return Object.keys(allLangs).sort();
    }
  });

  Object.defineProperty(OimPlayerClass.prototype, 'currentLang', {
    get: function (this: any) {
      return this._engine ? this._engine.lang : (this.getAttribute('lang') || 'es');
    }
  });

  Object.defineProperty(OimPlayerClass.prototype, 'lang', {
    get: function (this: any) {
      return this._engine ? this._engine.lang : (this.getAttribute('lang') || 'es');
    },
    set: function (this: any, val: string) {
      this.setAttribute('lang', val);
    }
  });

  customElements.define('oim-player', OimPlayerClass);
}

(window as any).OimPlayerElement = OimPlayerElement;

export const OimPlayer = {
  mount: function (containerId: string | HTMLElement, src: Blob | string, opts?: OimPlayerOptions) {
    const container = typeof containerId === 'string'
      ? document.getElementById(containerId)
      : containerId;
    if (!container) {
      console.error('[OimPlayer.mount] Container not found:', containerId);
      return null;
    }
    const el = document.createElement('oim-player') as any;
    el._oimOptions = opts || {};
    el.src = src;
    el.setAttribute('show-controls', (opts && opts.showLanguageSelector === false) ? 'false' : 'true');
    if (opts && opts.allowLottie === false) {
      el.setAttribute('allow-lottie', 'false');
    }
    if (container.replaceChildren) {
      container.replaceChildren(el);
    } else {
      container.innerHTML = '';
      container.appendChild(el);
    }
    return el;
  }
};

export const mount = OimPlayer.mount;
(window as any).OimPlayer = OimPlayer;
export { OimPlayerElement };
export default OimPlayer;
