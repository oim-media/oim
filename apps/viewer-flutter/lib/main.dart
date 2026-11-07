// Copyright (c) 2026 Xue Studios LLC
// SPDX-License-Identifier: Apache-2.0

import 'dart:io';
import 'package:flutter/material.dart';
import 'package:file_picker/file_picker.dart';
import 'package:oim_flutter/oim_flutter.dart';
import 'package:flutter/services.dart';
import 'library/library_client.dart';
import 'library/library_bench.dart';
import 'library/library_screen.dart';
import 'ui/i18n.dart';
import 'viewer_format.dart';

// Design tokens mirrored from apps/viewer-desktop (Tauri) so both viewers look the same.
const _bg = Color(0xFF09090B);
const _bgCenter = Color(0xFF131317);
const _topBarBg = Color(0xE00E0E12);
const _drawerBg = Color(0xEB101014);
const _border = Color(0x14FFFFFF);
const _text = Color(0xFFF4F4F5);
const _textSoft = Color(0xFFE4E4E7);
const _textSecondary = Color(0xFFA1A1AA);
const _textMuted = Color(0xFF71717A);
const _chipBg = Color(0x0DFFFFFF);
const _chipBorder = Color(0x17FFFFFF);
const _signed = Color(0xFF38BDF8);
const _unsigned = Color(0xFFA1A1AA);
const _ok = Color(0xFF22C55E);
const _mono = TextStyle(
    fontFamily: 'Consolas', fontFamilyFallback: ['Menlo', 'monospace']);

/// A path given on the command line ("Open with" on Windows) is opened at start.
String? _initialPath;
bool _bench = false;

void main(List<String> args) {
  _bench = args.contains('--library-bench');
  final files = args.where((a) => !a.startsWith('--')).toList();
  _initialPath = files.isEmpty ? null : files.first;
  runApp(const OimViewerApp());
}

class OimViewerApp extends StatelessWidget {
  const OimViewerApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'OIM Viewer',
      debugShowCheckedModeBanner: false,
      theme: ThemeData.dark().copyWith(
        scaffoldBackgroundColor: _bg,
        colorScheme:
            const ColorScheme.dark(primary: Colors.white, surface: _bg),
      ),
      home: const OimViewerScreen(),
    );
  }
}

class OimViewerScreen extends StatefulWidget {
  const OimViewerScreen({super.key});

  @override
  State<OimViewerScreen> createState() => _OimViewerScreenState();
}

class _OimViewerScreenState extends State<OimViewerScreen> {
  @override
  void initState() {
    super.initState();
    final path = _initialPath;
    if (path != null) {
      File(path)
          .readAsBytes()
          .then((b) => _load(b, fileNameOf(path)))
          .catchError((Object e) {
        if (mounted) setState(() => _error = t('No se pudo abrir $path', 'Could not open $path'));
      });
    }
    if (_bench) WidgetsBinding.instance.addPostFrameCallback((_) => _openLibrary(bench: LibraryBench()));
  }

  Uint8List? _bytes;
  OimExtractionResult? _result;
  OimSecurityStatus? _status;
  String _fileName = 'OIM Viewer';
  String _language = '';
  String? _palette;
  bool _showLayers = true;
  bool _allowLottie = true;
  bool _playMotion = true;
  bool _inspectorOpen = true;
  String? _error;
  final _library = LibraryClient();

  void _openLibrary({LibraryBench? bench}) {
    Navigator.of(context).push(MaterialPageRoute<void>(
      builder: (_) => LibraryScreen(
        client: _library,
        bench: bench,
        onOpen: (item, bytes) {
          Navigator.of(context).pop();
          _load(bytes, item.title);
        },
      ),
    ));
  }

  Map<String, dynamic>? get _meta => _result?.metadata;

  List<String> get _palettes {
    final meta = _meta;
    if (meta == null) return const [];
    final raw = meta['palettes'];
    if (raw is Map) {
      return raw.keys.map((k) => k.toString()).toList();
    }
    return const [];
  }

  List<String> get _languages {
    final meta = _meta;
    if (meta == null) return const [];
    final declared = meta['languages'];
    final found = <String>[];
    if (declared is List) {
      found.addAll(declared.map((e) => e.toString()));
    }
    if (found.isEmpty) {
      for (final slot in (meta['slots'] as List? ?? const [])) {
        final content = slot is Map ? slot['content'] : null;
        if (content is Map) {
          for (final k in content.keys) {
            final key = k.toString();
            if (key != '*' && !found.contains(key)) found.add(key);
          }
        }
      }
    }
    return found;
  }

  Future<void> _pickFile() async {
    final picked = await FilePicker.platform.pickFiles(
      type: FileType.custom,
      allowedExtensions: ['png', 'oim'],
      withData: true,
    );
    if (picked == null || picked.files.isEmpty) return;
    final file = picked.files.first;
    Uint8List? bytes = file.bytes;
    if (bytes == null && file.path != null) {
      bytes = await File(file.path!).readAsBytes();
    }
    if (bytes == null) return;
    _load(bytes, file.name);
  }

  void _load(Uint8List bytes, String name) {
    try {
      final result = extractOIM(bytes);
      final status = verifyOim(result);
      if (isRefused(status)) {
        // An altered file is not shown: neither its image nor its layers.
        setState(() => _error =
            t('Archivo alterado (${_badgeFor(status).text}): no se muestra.', 'File altered (${_badgeFor(status).text}): not shown.'));
        return;
      }
      final langs = (result.metadata['languages'] as List?)
              ?.map((e) => e.toString())
              .toList() ??
          const <String>[];
      final pals = (result.metadata['palettes'] as Map?)
              ?.keys
              .map((e) => e.toString())
              .toList() ??
          const <String>[];
      final defaultPal = result.metadata['defaultPalette']?.toString();
      setState(() {
        _bytes = bytes;
        _result = result;
        _status = status;
        _fileName = name;
        _language = langs.isNotEmpty ? langs.first : '';
        _palette = (defaultPal != null && pals.contains(defaultPal))
            ? defaultPal
            : (pals.isNotEmpty ? pals.first : null);
        _error = null;
      });
    } catch (e) {
      setState(() => _error = t('No se pudo leer el archivo OIM: $e', 'Could not read the OIM file: $e'));
    }
  }

  @override
  Widget build(BuildContext context) {
    // Same keys as the Tauri viewer; F11 needs a window plugin and is left out.
    return CallbackShortcuts(
        bindings: {
          const SingleActivator(LogicalKeyboardKey.space): () =>
              setState(() => _playMotion = !_playMotion),
          const SingleActivator(LogicalKeyboardKey.keyL): () =>
              setState(() => _showLayers = !_showLayers),
          const SingleActivator(LogicalKeyboardKey.keyI): () =>
              setState(() => _inspectorOpen = !_inspectorOpen),
          const SingleActivator(LogicalKeyboardKey.keyO, control: true):
              _pickFile,
          const SingleActivator(LogicalKeyboardKey.keyB, control: true):
              _openLibrary,
        },
        child: Focus(
            autofocus: true,
            child: Scaffold(
              body: Container(
                decoration: const BoxDecoration(
                  gradient: RadialGradient(
                      center: Alignment(0, -0.1),
                      radius: 0.9,
                      colors: [_bgCenter, _bg]),
                ),
                child: Column(
                  children: [
                    _TopBar(
                      fileName: _fileName,
                      sizeLabel:
                          _bytes == null ? null : _formatSize(_bytes!.length),
                      status: _status,
                      hasFile: _bytes != null,
                      inspectorOpen: _inspectorOpen,
                      palettes: _palettes,
                      selectedPalette: _palette,
                      onSelectPalette: (p) => setState(() => _palette = p),
                      onOpen: _pickFile,
                      onToggleInspector: () =>
                          setState(() => _inspectorOpen = !_inspectorOpen),
                      onLibrary: _openLibrary,
                    ),
                    if (_error != null)
                      Container(
                        width: double.infinity,
                        color: const Color(0x33EF4444),
                        padding: const EdgeInsets.symmetric(
                            horizontal: 14, vertical: 6),
                        child: Text(_error!,
                            style: const TextStyle(
                                color: Color(0xFFFCA5A5), fontSize: 12)),
                      ),
                    Expanded(
                      child: LayoutBuilder(
                        builder: (context, c) {
                          final wide = c.maxWidth >= 720;
                          final drawerVisible =
                              _inspectorOpen && _result != null;
                          final stage = _bytes == null
                              ? _EmptyState(
                                  onOpen: _pickFile, onLibrary: _openLibrary)
                              : Padding(
                                  padding: const EdgeInsets.all(20),
                                  child: Center(
                                    child: ClipRRect(
                                      borderRadius: BorderRadius.circular(10),
                                      child: OimPlayer(
                                        bytes: _bytes!,
                                        language: _language.isEmpty
                                            ? null
                                            : _language,
                                        palette: _palette,
                                        isInteractive: _showLayers,
                                        allowLottie: _allowLottie,
                                        disableAnimations: !_playMotion,
                                      ),
                                    ),
                                  ),
                                );
                          final drawer = drawerVisible
                              ? _InspectorDrawer(
                                  fileName: _fileName,
                                  sizeLabel: _formatSize(_bytes!.length),
                                  meta: _meta!,
                                  status: _status!,
                                  languages: _languages,
                                  language: _language,
                                  palettes: _palettes,
                                  palette: _palette,
                                  showLayers: _showLayers,
                                  allowLottie: _allowLottie,
                                  playMotion: _playMotion,
                                  onToggleLayers: () => setState(
                                      () => _showLayers = !_showLayers),
                                  onToggleLottie: () => setState(
                                      () => _allowLottie = !_allowLottie),
                                  onToggleMotion: () => setState(
                                      () => _playMotion = !_playMotion),
                                  onSelectLanguage: (l) =>
                                      setState(() => _language = l),
                                  onSelectPalette: (p) =>
                                      setState(() => _palette = p),
                                )
                              : null;
                          if (drawer == null) return stage;
                          if (wide) {
                            return Row(
                                children: [Expanded(child: stage), drawer]);
                          }
                          return Stack(children: [
                            stage,
                            Positioned(
                                top: 0, bottom: 0, right: 0, child: drawer)
                          ]);
                        },
                      ),
                    ),
                  ],
                ),
              ),
            )));
  }
}

class _Badge {
  const _Badge(this.text, this.color);
  final String text;
  final Color color;
}

/// Same labels and colors as getSecurityBadgeConfig in the Tauri viewer.
_Badge _badgeFor(OimSecurityStatus? s) {
  switch (s) {
    case OimSecurityStatus.verified:
      return _Badge(t('Firmado con OIM', 'Signed with OIM'), _ok);
    case OimSecurityStatus.verifiedAuthorless:
      return _Badge(t('Firmado · sin autoría', 'Signed · no authorship'), _signed);
    case OimSecurityStatus.imageUnsealed:
      return _Badge(t('Firmado · sin sello', 'Signed · unsealed'), const Color(0xFFCBD5E1));
    case OimSecurityStatus.expiredKey:
      return _Badge(t('Clave expirada', 'Expired key'), const Color(0xFFF59E0B));
    case OimSecurityStatus.unknownKey:
      return _Badge(t('Clave desconocida', 'Unknown key'), const Color(0xFFF59E0B));
    case OimSecurityStatus.imageMismatch:
      return _Badge(t('Imagen alterada', 'Image altered'), const Color(0xFFEF4444));
    case OimSecurityStatus.invalidSignature:
      return _Badge(t('Firma inválida', 'Invalid signature'), const Color(0xFFEF4444));
    case OimSecurityStatus.unsigned:
    case null:
      return _Badge(t('Sin firma', 'Unsigned'), _unsigned);
  }
}

String _formatSize(int bytes) {
  if (bytes < 1024) return '$bytes B';
  if (bytes < 1024 * 1024) return '${(bytes / 1024).toStringAsFixed(1)} KB';
  return '${(bytes / (1024 * 1024)).toStringAsFixed(1)} MB';
}

String _compactTitle(String name, int max) {
  final base = name.replaceAll(
      RegExp(r'\.oim(\.png)?$|\.png$', caseSensitive: false), '');
  return base.length <= max ? base : '${base.substring(0, max)}...';
}

class _TopBar extends StatelessWidget {
  const _TopBar({
    required this.fileName,
    required this.sizeLabel,
    required this.status,
    required this.hasFile,
    required this.inspectorOpen,
    required this.palettes,
    required this.selectedPalette,
    required this.onSelectPalette,
    required this.onOpen,
    required this.onToggleInspector,
    required this.onLibrary,
  });

  final String fileName;
  final String? sizeLabel;
  final OimSecurityStatus? status;
  final bool hasFile;
  final bool inspectorOpen;
  final List<String> palettes;
  final String? selectedPalette;
  final ValueChanged<String?> onSelectPalette;
  final VoidCallback onOpen;
  final VoidCallback onToggleInspector;
  final VoidCallback onLibrary;

  @override
  Widget build(BuildContext context) {
    final badge = _badgeFor(status);
    final color = !hasFile ? _unsigned : badge.color;
    return Container(
      height: 42,
      padding: const EdgeInsets.symmetric(horizontal: 14),
      decoration: const BoxDecoration(
        color: _topBarBg,
        border: Border(bottom: BorderSide(color: _border)),
      ),
      child: Row(
        children: [
          Container(
            width: 7,
            height: 7,
            decoration: BoxDecoration(
              color: color,
              shape: BoxShape.circle,
              boxShadow: [
                BoxShadow(color: color.withValues(alpha: 0.6), blurRadius: 8)
              ],
            ),
          ),
          const SizedBox(width: 10),
          Flexible(
            child: Text(
              hasFile ? _compactTitle(fileName, 18) : 'OIM Viewer',
              overflow: TextOverflow.ellipsis,
              style: _mono.copyWith(fontSize: 12, color: _textSoft),
            ),
          ),
          const Spacer(),
          if (sizeLabel != null) ...[
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 3),
              decoration: BoxDecoration(
                color: _chipBg,
                border: Border.all(color: _border),
                borderRadius: BorderRadius.circular(6),
              ),
              child: Text(sizeLabel!,
                  style: _mono.copyWith(fontSize: 10, color: _textSecondary)),
            ),
            const SizedBox(width: 6),
          ],
          if (palettes.isNotEmpty) ...[
            PopupMenuButton<String>(
              tooltip: t('Cambiar tema de color', 'Change colour theme'),
              color: _drawerBg,
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(8),
                side: const BorderSide(color: _border),
              ),
              onSelected: onSelectPalette,
              itemBuilder: (context) => [
                for (final p in palettes)
                  PopupMenuItem<String>(
                    value: p,
                    height: 32,
                    child: Row(
                      children: [
                        if (p.toLowerCase() ==
                            (selectedPalette ?? '').toLowerCase())
                          const Icon(Icons.check, size: 14, color: Colors.white)
                        else
                          const SizedBox(width: 14),
                        const SizedBox(width: 8),
                        Text(
                          p.toUpperCase(),
                          style: TextStyle(
                            fontSize: 11,
                            fontWeight: p.toLowerCase() ==
                                    (selectedPalette ?? '').toLowerCase()
                                ? FontWeight.w700
                                : FontWeight.normal,
                            color: _text,
                          ),
                        ),
                      ],
                    ),
                  ),
              ],
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 5),
                decoration: BoxDecoration(
                  color: _chipBg,
                  border: Border.all(color: _chipBorder),
                  borderRadius: BorderRadius.circular(7),
                ),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    const Icon(Icons.palette_outlined,
                        size: 13, color: _textSoft),
                    const SizedBox(width: 4),
                    Text(
                      selectedPalette?.toUpperCase() ?? t('TEMA', 'THEME'),
                      style: const TextStyle(
                          fontSize: 11,
                          color: _textSoft,
                          fontWeight: FontWeight.w600),
                    ),
                  ],
                ),
              ),
            ),
            const SizedBox(width: 6),
          ],
          _BarButton(
              icon: Icons.grid_view_outlined,
              label: t('Biblioteca', 'Library'),
              onTap: onLibrary),
          const SizedBox(width: 6),
          _BarButton(
              icon: Icons.folder_open_outlined,
              label: t('Cargar otro', 'Load another'),
              onTap: onOpen),
          if (hasFile) ...[
            const SizedBox(width: 6),
            _BarButton(
                icon: Icons.tune,
                label: t('Ajustes', 'Settings'),
                active: inspectorOpen,
                onTap: onToggleInspector),
          ],
        ],
      ),
    );
  }
}

class _BarButton extends StatelessWidget {
  const _BarButton(
      {required this.icon,
      required this.label,
      required this.onTap,
      this.active = false});

  final IconData icon;
  final String label;
  final VoidCallback onTap;
  final bool active;

  @override
  Widget build(BuildContext context) {
    final fg = active ? _bg : _textSoft;
    return InkWell(
      borderRadius: BorderRadius.circular(7),
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 5),
        decoration: BoxDecoration(
          color: active ? Colors.white : _chipBg,
          border: Border.all(color: active ? Colors.white : _chipBorder),
          borderRadius: BorderRadius.circular(7),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(icon, size: 13, color: fg),
            const SizedBox(width: 5),
            Text(label,
                style: TextStyle(
                    fontSize: 11,
                    color: fg,
                    fontWeight: active ? FontWeight.w700 : FontWeight.w500)),
          ],
        ),
      ),
    );
  }
}

class _EmptyState extends StatelessWidget {
  const _EmptyState({required this.onOpen, required this.onLibrary});

  final VoidCallback onOpen;
  final VoidCallback onLibrary;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Text(t('Abre un archivo .oim.png', 'Open a .oim.png file'),
              style: const TextStyle(
                  fontSize: 16, color: _text, fontWeight: FontWeight.w600)),
          const SizedBox(height: 6),
          Text(t('Se lee y se dibuja de forma nativa, sin navegador.', 'Read and drawn natively, no browser.'),
              style: const TextStyle(fontSize: 12, color: _textMuted)),
          const SizedBox(height: 18),
          InkWell(
            borderRadius: BorderRadius.circular(8),
            onTap: onOpen,
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 9),
              decoration: BoxDecoration(
                  color: Colors.white, borderRadius: BorderRadius.circular(8)),
              child: Text(t('Cargar archivo', 'Load file'),
                  style: const TextStyle(
                      color: _bg, fontSize: 12, fontWeight: FontWeight.w700)),
            ),
          ),
          const SizedBox(height: 10),
          TextButton(
              onPressed: onLibrary,
              child: Text(t('Explorar la biblioteca pública', 'Browse the public library'),
                  style: const TextStyle(color: _textSecondary, fontSize: 12))),
        ],
      ),
    );
  }
}

class _InspectorDrawer extends StatelessWidget {
  const _InspectorDrawer({
    required this.fileName,
    required this.sizeLabel,
    required this.meta,
    required this.status,
    required this.languages,
    required this.language,
    required this.palettes,
    required this.palette,
    required this.showLayers,
    required this.allowLottie,
    required this.playMotion,
    required this.onToggleLayers,
    required this.onToggleLottie,
    required this.onToggleMotion,
    required this.onSelectLanguage,
    required this.onSelectPalette,
  });

  final String fileName;
  final String sizeLabel;
  final Map<String, dynamic> meta;
  final OimSecurityStatus status;
  final List<String> languages;
  final String language;
  final List<String> palettes;
  final String? palette;
  final bool showLayers;
  final bool allowLottie;
  final bool playMotion;
  final VoidCallback onToggleLayers;
  final VoidCallback onToggleLottie;
  final VoidCallback onToggleMotion;
  final ValueChanged<String> onSelectLanguage;
  final ValueChanged<String?> onSelectPalette;

  @override
  Widget build(BuildContext context) {
    final slots = (meta['slots'] as List? ?? const []);
    final canvas = meta['canvas'] as Map?;
    final w = canvas?['natural_width'];
    final h = canvas?['natural_height'];
    final dims = (w != null && h != null) ? '$w × $h px' : 'Responsive';
    final badge = _badgeFor(status);
    final reedit = '${meta['reedit'] ?? ''}';
    final reeditLabel = reedit == 'public'
        ? t('Público (editable)', 'Public (editable)')
        : reedit == 'sealed'
            ? t('Sellado (inmutable)', 'Sealed (immutable)')
            : t('Solo autor', 'Author only');
    final counts = <String, int>{};
    for (final s in slots) {
      final t = (s is Map ? s['type'] : null)?.toString() ?? 'other';
      counts[t] = (counts[t] ?? 0) + 1;
    }

    return Container(
      width: 290,
      decoration: const BoxDecoration(
        color: _drawerBg,
        border: Border(left: BorderSide(color: _border)),
      ),
      child: ListView(
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 16),
        children: [
          _SectionHeader(title: t('AJUSTES', 'SETTINGS'), trailing: '${slots.length} slots'),
          const SizedBox(height: 12),
          Row(
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(t('Capa interactiva', 'Interactive layer'),
                        style: const TextStyle(
                            fontSize: 12,
                            color: _text,
                            fontWeight: FontWeight.w500)),
                    Text(showLayers ? t('Superposición activa', 'Overlay on') : t('Base PNG plana', 'Flat PNG base'),
                        style:
                            const TextStyle(fontSize: 10, color: _textMuted)),
                  ],
                ),
              ),
              _Toggle(
                icon: showLayers
                    ? Icons.visibility_outlined
                    : Icons.visibility_off_outlined,
                label: showLayers ? 'Visible' : t('Oculta', 'Hidden'),
                active: showLayers,
                onTap: onToggleLayers,
              ),
            ],
          ),
          if (counts.containsKey('lottie')) ...[
            const SizedBox(height: 10),
            Row(
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(t('Animación Lottie', 'Lottie animation'),
                          style: const TextStyle(
                              fontSize: 12,
                              color: _text,
                              fontWeight: FontWeight.w500)),
                      Text(allowLottie ? t('Reproduciendo', 'Playing') : t('Desactivado', 'Off'),
                          style:
                              const TextStyle(fontSize: 10, color: _textMuted)),
                    ],
                  ),
                ),
                _Toggle(
                  icon: allowLottie
                      ? Icons.play_circle_outline
                      : Icons.pause_circle_outline,
                  label: allowLottie ? t('Activo', 'On') : t('Pausado', 'Paused'),
                  active: allowLottie,
                  onTap: onToggleLottie,
                ),
              ],
            ),
          ],
          if (slots.any((s) {
            if (s is! Map) return false;
            final st = s['style'] as Map?;
            final p = s['parallax'] ?? st?['parallax'];
            return (p is Map && p['enabled'] == true) ||
                st?['sceneLoop'] != null;
          })) ...[
            const SizedBox(height: 10),
            Row(
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(t('Movimiento continuo', 'Continuous motion'),
                          style: const TextStyle(
                              fontSize: 12,
                              color: _text,
                              fontWeight: FontWeight.w500)),
                      Text(playMotion ? t('Bucle en vivo', 'Live loop') : t('Pausado', 'Paused'),
                          style:
                              const TextStyle(fontSize: 10, color: _textMuted)),
                    ],
                  ),
                ),
                _Toggle(
                  icon: playMotion ? Icons.animation : Icons.motion_photos_off,
                  label: playMotion ? t('Activo', 'On') : t('Pausado', 'Paused'),
                  active: playMotion,
                  onTap: onToggleMotion,
                ),
              ],
            ),
          ],
          if (languages.length > 1) ...[
            const SizedBox(height: 12),
            Text(t('Idioma', 'Language'),
                style: const TextStyle(
                    fontSize: 12, color: _text, fontWeight: FontWeight.w500)),
            const SizedBox(height: 6),
            Wrap(
              spacing: 4,
              runSpacing: 4,
              children: [
                for (final l in languages)
                  _LangChip(
                      label: l.toUpperCase(),
                      active: l.toLowerCase() == language.toLowerCase(),
                      onTap: () => onSelectLanguage(l)),
              ],
            ),
          ],
          if (palettes.isNotEmpty) ...[
            const SizedBox(height: 12),
            Text(t('Tema de color / Paleta', 'Colour theme / Palette'),
                style: const TextStyle(
                    fontSize: 12, color: _text, fontWeight: FontWeight.w500)),
            const SizedBox(height: 6),
            Wrap(
              spacing: 4,
              runSpacing: 4,
              children: [
                for (final p in palettes)
                  _LangChip(
                    label: p.toUpperCase(),
                    active: p.toLowerCase() == (palette ?? '').toLowerCase(),
                    onTap: () => onSelectPalette(p),
                  ),
              ],
            ),
          ],
          const SizedBox(height: 16),
          const Divider(height: 1, color: _border),
          const SizedBox(height: 16),
          _SectionHeader(
              title: t('FICHA TÉCNICA', 'DETAILS'), trailing: schemaVersionOf(meta)),
          const SizedBox(height: 12),
          _SpecRow(label: t('Archivo', 'File'), value: fileName, mono: true),
          _SpecRow(label: t('Peso', 'Size'), value: sizeLabel, mono: true),
          _SpecRow(label: t('Resolución', 'Resolution'), value: dims),
          _SpecRow(
              label: t('Esquema OIM', 'OIM schema'), value: schemaVersionOf(meta), mono: true),
          _SpecRow(
              label: t('Reedición', 'Re-editing'),
              value: reeditLabel,
              valueColor: reedit == 'public' ? _ok : null),
          _SpecRow(
            label: t('Firma', 'Signature'),
            value: badge.text,
            valueColor: badge.color,
          ),
          if (counts.isNotEmpty) ...[
            const SizedBox(height: 4),
            Text(t('Desglose de capas', 'Layer breakdown'),
                style: const TextStyle(fontSize: 10, color: _textMuted)),
            const SizedBox(height: 5),
            Wrap(
              spacing: 4,
              runSpacing: 4,
              children: [
                for (final e in counts.entries)
                  Container(
                    padding:
                        const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                    decoration: BoxDecoration(
                        color: _chipBg, borderRadius: BorderRadius.circular(4)),
                    child: Text.rich(
                      TextSpan(
                        style: _mono.copyWith(
                            fontSize: 10, color: const Color(0xFFD4D4D8)),
                        children: [
                          TextSpan(text: '${e.key.toUpperCase()} '),
                          TextSpan(
                              text: '${e.value}',
                              style: const TextStyle(
                                  color: Colors.white,
                                  fontWeight: FontWeight.w700)),
                        ],
                      ),
                    ),
                  ),
              ],
            ),
          ],
        ],
      ),
    );
  }
}

class _SectionHeader extends StatelessWidget {
  const _SectionHeader({required this.title, required this.trailing});

  final String title;
  final String trailing;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.only(bottom: 8),
      decoration: const BoxDecoration(
          border: Border(bottom: BorderSide(color: _border))),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(title,
              style: const TextStyle(
                  fontSize: 11,
                  color: _textSecondary,
                  fontWeight: FontWeight.w700,
                  letterSpacing: 0.66)),
          Text(trailing,
              style: _mono.copyWith(fontSize: 10, color: _textMuted)),
        ],
      ),
    );
  }
}

class _Toggle extends StatelessWidget {
  const _Toggle(
      {required this.icon,
      required this.label,
      required this.active,
      required this.onTap});

  final IconData icon;
  final String label;
  final bool active;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final fg = active ? _bg : _textSecondary;
    return InkWell(
      borderRadius: BorderRadius.circular(6),
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 4),
        decoration: BoxDecoration(
          color: active ? Colors.white : Colors.transparent,
          border: Border.all(
              color: active ? Colors.white : const Color(0x1FFFFFFF)),
          borderRadius: BorderRadius.circular(6),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(icon, size: 13, color: fg),
            const SizedBox(width: 5),
            Text(label,
                style: TextStyle(
                    fontSize: 11, color: fg, fontWeight: FontWeight.w600)),
          ],
        ),
      ),
    );
  }
}

class _LangChip extends StatelessWidget {
  const _LangChip(
      {required this.label, required this.active, required this.onTap});

  final String label;
  final bool active;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return InkWell(
      borderRadius: BorderRadius.circular(5),
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 3),
        decoration: BoxDecoration(
          color: active ? Colors.white : Colors.transparent,
          border: Border.all(color: active ? Colors.white : _chipBorder),
          borderRadius: BorderRadius.circular(5),
        ),
        child: Text(label,
            style: TextStyle(
                fontSize: 11,
                fontWeight: FontWeight.w600,
                color: active ? _bg : const Color(0xFFD4D4D8))),
      ),
    );
  }
}

class _SpecRow extends StatelessWidget {
  const _SpecRow(
      {required this.label,
      required this.value,
      this.mono = false,
      this.valueColor});

  final String label;
  final String value;
  final bool mono;
  final Color? valueColor;

  @override
  Widget build(BuildContext context) {
    final style = (mono ? _mono : const TextStyle())
        .copyWith(fontSize: 11, color: valueColor ?? _text);
    return Padding(
      padding: const EdgeInsets.only(bottom: 9),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.baseline,
        textBaseline: TextBaseline.alphabetic,
        children: [
          Text(label, style: const TextStyle(fontSize: 11, color: _textMuted)),
          const SizedBox(width: 10),
          Expanded(
              child: Text(value,
                  textAlign: TextAlign.right,
                  overflow: TextOverflow.ellipsis,
                  style: style)),
        ],
      ),
    );
  }
}
