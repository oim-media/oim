/**
 * <ovm-player> — Web Component for OVM video playback
 *
 * Framework-agnostic. Uses HTTP Range requests to extract metadata
 * from trailing bytes, delegates video buffering to native <video>.
 *
 * Attributes:
 *   src      — URL of the .ovm file
 *   lang     — language code (es, en, zh, etc.)
 *   autoplay — if present, video plays automatically
 *
 * Usage:
 *   <ovm-player src="video.ovm" lang="es"></ovm-player>
 */
(function () {
  'use strict';

  var METADATA_TAIL_BYTES = 65536;
  var STYLES = [
    ':host { display:block; position:relative; width:100%; aspect-ratio:16/9;',
    'background:#000; border-radius:8px; overflow:hidden; contain:layout style paint; }',
    'video { display:block; width:100%; height:100%; object-fit:contain; background:#000; }',
    '.overlay { position:absolute; inset:0; pointer-events:none; z-index:2; }',
    '.slot { position:absolute; transform:translate(-50%,-50%); white-space:nowrap;',
    'font-family:var(--ovm-font,"Inter",system-ui,sans-serif);',
    'text-shadow:0 1px 4px rgba(0,0,0,0.8),0 0 8px rgba(0,0,0,0.5); }',
    '.loader { position:absolute; inset:0; display:flex; align-items:center; justify-content:center;',
    'color:rgba(255,255,255,0.4); font-family:var(--ovm-mono,"JetBrains Mono",monospace);',
    'font-size:12px; z-index:3; }',
    '.loader.error { color:#ef4444; }'
  ].join('\n');

  async function decompressBytes(bytes, format) {
    var ds = new DecompressionStream(format);
    var writer = ds.writable.getWriter();
    writer.write(bytes);
    writer.close();
    var response = new Response(ds.readable);
    var decompressedBuffer = await response.arrayBuffer();
    return new TextDecoder().decode(decompressedBuffer);
  }

  async function decodeAndDecompressJSON(base64Str) {
    var cleanB64 = base64Str.replace(/\s+/g, '');
    var binary = atob(cleanB64);
    var bytes = new Uint8Array(binary.length);
    for (var i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    try {
      var decompressed = await decompressBytes(bytes, 'deflate');
      return JSON.parse(decompressed);
    } catch (e1) {
      try {
        var decompressedRaw = await decompressBytes(bytes, 'deflate-raw');
        return JSON.parse(decompressedRaw);
      } catch (e2) {
        console.error('[OvmPlayer] Decompression failed for both deflate and deflate-raw:', e1, e2);
        throw e2;
      }
    }
  }

  async function extractOvmMetadataFromVideo(src) {
    try {
      var resp = await fetch(src, {
        headers: { Range: 'bytes=0-262143' }
      });
      if (!resp.ok && resp.status !== 206) {
        throw new Error('HTTP ' + resp.status);
      }
      var buffer = await resp.arrayBuffer();
      var bytes = new Uint8Array(buffer);
      var text = new TextDecoder().decode(bytes);
      
      var idx = text.indexOf('OVM_Metadata');
      if (idx === -1) {
        idx = text.indexOf('metadata.ovmdata');
      }
      if (idx === -1) {
        throw new Error('OVM_Metadata signature not found in video header');
      }

      var slice = text.substring(idx);
      var match = slice.match(/[A-Za-z0-9+/=]{100,}/);
      if (!match) {
        throw new Error('Base64 metadata block not found after signature');
      }

      var b64 = match[0];
      for (var i = b64.length; i >= 10; i--) {
        var cand = b64.substring(0, i);
        if (cand.length % 4 !== 0) {
          cand += '='.repeat(4 - (cand.length % 4));
        }
        try {
          var parsed = await decodeAndDecompressJSON(cand);
          if (parsed && (parsed.slots || parsed.elements || parsed.layers)) {
            return parsed;
          }
        } catch (_) {
          // Keep trying smaller prefix to discard trailing garbage bytes
        }
      }
      throw new Error('Failed to decompress base64 metadata block');
    } catch (e) {
      console.warn('[OvmPlayer] Error extracting embedded metadata:', e);
      return null;
    }
  }

  var OvmPlayer = (function () {
    function OvmPlayer() {
      var self = this;
      self._metadata = null;
      self._currentTime = 0;
      self._shadow = self.attachShadow({ mode: 'open' });
      var style = document.createElement('style');
      style.textContent = STYLES;
      self._shadow.appendChild(style);
      self._loader = document.createElement('div');
      self._loader.className = 'loader';
      self._loader.textContent = 'Extrayendo metadatos\u2026';
      self._shadow.appendChild(self._loader);
      self._video = document.createElement('video');
      self._video.preload = 'metadata';
      self._video.playsInline = true;
      self._video.style.display = 'none';
      self._shadow.appendChild(self._video);
      self._overlay = document.createElement('div');
      self._overlay.className = 'overlay';
      self._shadow.appendChild(self._overlay);
      self._onTimeUpdate = function () {
        self._currentTime = self._video.currentTime;
        self._renderSlots();
      };
      return self;
    }

    return OvmPlayer;
  })();

  OvmPlayer.observedAttributes = ['src', 'lang'];

  OvmPlayer.prototype.connectedCallback = function () {
    this._video.addEventListener('timeupdate', this._onTimeUpdate);
    if (this.hasAttribute('autoplay')) {
      this._video.autoplay = true;
    }
  };

  OvmPlayer.prototype.disconnectedCallback = function () {
    this._video.removeEventListener('timeupdate', this._onTimeUpdate);
  };

  OvmPlayer.prototype.attributeChangedCallback = function (name, oldVal, newVal) {
    if (oldVal === newVal) return;
    if (name === 'src' && newVal) {
      this._load(newVal);
    } else if (name === 'lang') {
      this._renderSlots();
    }
  };

  Object.defineProperties(OvmPlayer.prototype, {
    src: {
      get: function () { return this.getAttribute('src') || ''; },
      set: function (v) { this.setAttribute('src', v); }
    },
    lang: {
      get: function () { return this.getAttribute('lang') || 'es'; },
      set: function (v) { this.setAttribute('lang', v); }
    }
  });


  // ===== SCHEMA VALIDATOR (inline Zod-equivalent) =====
  function validateOvmMetadata(json) {
    var errors = [];
    function fail(msg) { errors.push(msg); }
    function okStr(v, max) { return typeof v === "string" && v.length <= (max || 2000); }
    function okNum(v) { return typeof v === "number" && isFinite(v); }

    if (typeof json !== "object" || json === null) { fail("metadata must be object"); return errors; }

    var slots = json.slots || json.elements || [];
    if (!Array.isArray(slots)) { fail("slots must be array"); return errors; }
    if (slots.length > 50) { fail("max 50 slots"); }

    for (var i = 0; i < slots.length; i++) {
      var s = slots[i];
      if (typeof s !== "object" || s === null) { fail("slot[" + i + "] must be object"); continue; }
      if (!s.id || typeof s.id !== "string" || s.id.length > 128) fail("slot[" + i + "].id invalid");

      var content = s.content;
      if (typeof content !== "object" || content === null) { fail("slot[" + i + "].content must be object"); }
      else {
        var keys = Object.keys(content);
        for (var k = 0; k < keys.length; k++) {
          if (!okStr(content[keys[k]])) fail("slot[" + i + "].content." + keys[k] + " invalid");
        }
      }

      // `fillColor` and not `color`: contract 1.5.0 removed the aliases of
      // `style`, and the compiler now only writes the canonical ones.
      if (s.style && s.style.fillColor && !/^#[0-9a-fA-F]{3,8}$/.test(s.style.fillColor)) {
        fail("slot[" + i + "].style.fillColor invalid");
      }

      if (s.position && (!Array.isArray(s.position) || s.position.length < 2 || !okNum(s.position[0]) || !okNum(s.position[1]))) {
        fail("slot[" + i + "].position invalid");
      }
    }

    return errors;
  }

  OvmPlayer.prototype._load = async function (src) {
    var self = this;
    self._showLoader('Extrayendo metadatos\u2026', false);
    
    try {
      // 1. Try extracting metadata from the video header
      var metadata = await extractOvmMetadataFromVideo(src);
      
      // 2. Try extracting from trailing bytes (tail range requests)
      if (!metadata) {
        try {
          metadata = await self._fetchMetadataTail(src);
        } catch (_) {}
      }
      
      // 3. Try fallback sidecar JSON file
      if (!metadata) {
        try {
          var res = await fetch(src + '.json');
          if (res.ok) {
            metadata = await res.json();
          }
        } catch (_) {}
      }
      
      if (!metadata) {
        throw new Error('No se encontraron metadatos OVM');
      }
      
      var errs = validateOvmMetadata(metadata);
      if (errs.length > 0) {
        console.error('[ovm-player] Metadata invalida:', errs);
        throw new Error('Corrupted or Tampered OVM file: ' + errs[0]);
      }
      
      self._metadata = metadata;
      self._video.src = src;
      self._video.style.display = 'block';
      self._hideLoader();
      self._renderSlots();
    } catch (err) {
      console.error('[ovm-player]', err);
      self._showLoader(err.message, true);
    }
  };

  OvmPlayer.prototype._fetchMetadataTail = function (src) {
    return fetch(src, { headers: { Range: 'bytes=-' + METADATA_TAIL_BYTES } })
      .then(function (res) {
        if (!res.ok) throw new Error('HTTP ' + res.status);
        return res.arrayBuffer();
      })
      .then(function (buffer) {
        return new Uint8Array(buffer);
      })
      .then(this._extractJSONFromTail);
  };

  OvmPlayer.prototype._extractJSONFromTail = function (bytes) {
    var text = new TextDecoder().decode(bytes);
    var len = text.length;

    // Find JSON with OVM metadata signature near the opening brace
    function hasOvmSig(t, start) {
      var head = t.substring(start, Math.min(start + 80, t.length));
      return head.indexOf('ovm_version') !== -1 || head.indexOf('slots') !== -1;
    }

    function findClosing(t, start) {
      var depth = 0, inStr = false, esc = false;
      for (var i = start; i < t.length; i++) {
        var ch = t[i];
        if (esc) { esc = false; continue; }
        if (ch === '\\') { esc = true; continue; }
        if (ch === '"') { inStr = !inStr; continue; }
        if (inStr) continue;
        if (ch === '{') { depth++; }
        else if (ch === '}') { depth--; if (depth === 0) return t.substring(start, i + 1); }
      }
      return null;
    }

    // Priority: match by signature first
    for (var i = 0; i < len; i++) {
      if (text[i] !== '{') continue;
      if (!hasOvmSig(text, i)) continue;
      var json = findClosing(text, i);
      if (!json) continue;
      try { return JSON.parse(json); } catch (_) {}
    }

    // Fallback: any JSON with slots/layers
    for (var j = 0; j < len; j++) {
      if (text[j] !== '{') continue;
      var jjson = findClosing(text, j);
      if (!jjson) continue;
      try {
        var parsed = JSON.parse(jjson);
        if (parsed.slots || parsed.elements || parsed.layers) return parsed;
      } catch (_) {}
    }

    return null;
  };

  OvmPlayer.prototype._showLoader = function (msg, isError) {
    this._loader.textContent = msg;
    this._loader.className = isError ? 'loader error' : 'loader';
    this._loader.style.display = 'flex';
  };

  OvmPlayer.prototype._hideLoader = function () {
    this._loader.style.display = 'none';
  };

  OvmPlayer.prototype._renderSlots = function () {
    if (!this._metadata) return;
    var slots = this._metadata.slots || this._metadata.elements || [];
    var lang = this.lang;
    var t = this._currentTime;
    this._overlay.innerHTML = '';
    for (var i = 0; i < slots.length; i++) {
      var slot = slots[i];
      var content = slot.content || {};
      var text = content[lang] || content.en || content.es || '';
      if (!text) continue;

      var left, top;
      var tracking = slot.tracking_data;
      if (tracking && tracking.length > 0) {
        var box = this._interpolateTracking(tracking, t);
        if (box) {
          left = ((box.x1 + box.x3) / 2) * 100;
          top = ((box.y1 + box.y3) / 2) * 100;
        }
      }

      if (left === undefined) {
        var pos = this._normPos(slot.position || [0.5, 0.5]);
        left = pos[0] * 100;
        top = pos[1] * 100;
      }

      var st = slot.style || {};
      var slotEl = document.createElement('div');
      slotEl.className = 'slot';
      slotEl.style.left = left.toFixed(2) + '%';
      slotEl.style.top = top.toFixed(2) + '%';
      // Canonical keys of contract 1.5.0. It used to read `color`, `size` and
      // `font`, which the compiler no longer writes: the text of a signed .ovm
      // came out without color, without size and without font.
      if (st.fillColor) slotEl.style.color = st.fillColor;
      if (st.fontSize) slotEl.style.fontSize = st.fontSize;
      if (st.fontFamily) slotEl.style.fontFamily = st.fontFamily + ',sans-serif';
      slotEl.textContent = text;
      this._overlay.appendChild(slotEl);
    }
  };

  OvmPlayer.prototype._interpolateTracking = function (keyframes, t) {
    if (keyframes.length === 1) {
      var c0 = keyframes[0].slice(1);
      return boxFrom(c0);
    }

    var before = null, after = null;
    for (var i = 0; i < keyframes.length; i++) {
      if (keyframes[i][0] <= t) before = keyframes[i];
      else { after = keyframes[i]; break; }
    }
    if (!before && after) return boxFrom(after.slice(1));
    if (before && !after) return boxFrom(before.slice(1));
    if (!before && !after) return null;

    var t0 = before[0], t1 = after[0];
    var p = t1 > t0 ? (t - t0) / (t1 - t0) : 0;
    p = Math.max(0, Math.min(1, p));

    var b1 = before.slice(1), b2 = after.slice(1);
    var interp = b1.map(function (v, idx) { return v + (b2[idx] - v) * p; });
    return boxFrom(interp);
  };

  function boxFrom(arr) {
    return { x1: arr[0], y1: arr[1], x2: arr[2], y2: arr[3], x3: arr[4], y3: arr[5], x4: arr[6], y4: arr[7] };
  }

  OvmPlayer.prototype._normPos = function (pos) {
    var x = pos[0], y = pos[1];
    if (x > 1 || y > 1) { x /= 100; y /= 100; }
    return [x, y];
  };

  OvmPlayer.prototype._esc = function (text) {
    return String(text).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  };

  if (!customElements.get('ovm-player')) {
    customElements.define('ovm-player', OvmPlayer);
  }
})();
