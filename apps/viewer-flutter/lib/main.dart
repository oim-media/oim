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
import 'ui/tokens.dart';
import 'viewer_format.dart';

// Tokens shared with the library screen (ui/tokens.dart), mirrored from apps/viewer-desktop.
const _bg = kBg;
const _bgCenter = kBgCenter;
const _topBarBg = kTopBarBg;
const _drawerBg = kDrawerBg;
const _border = kBorder;
const _text = kText;
const _textSoft = kTextSoft;
const _textSecondary = kTextSecondary;
const _textMuted = kTextMuted;
const _chipBg = kChipBg;
const _chipBorder = kChipBorder;
const _signed = kSigned;
const _unsigned = kTextSecondary;
const _ok = kOk;
const _mono = kMono;

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
  const OimViewerApp({super.key, this.initialBytes, this.initialFileName});

  final Uint8List? initialBytes;
  final String? initialFileName;

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
      home: OimViewerScreen(
        initialBytes: initialBytes,
        initialFileName: initialFileName,
      ),
    );
  }
}

class OimViewerScreen extends StatefulWidget {
  const OimViewerScreen({super.key, this.initialBytes, this.initialFileName});

  final Uint8List? initialBytes;
  final String? initialFileName;

  @override
  State<OimViewerScreen> createState() => _OimViewerScreenState();
}

class _OimViewerScreenState extends State<OimViewerScreen> {
  @override
  void initState() {
    super.initState();
    final initialBytes = widget.initialBytes;
    if (initialBytes != null) {
      _load(initialBytes, widget.initialFileName ?? 'artwork.oim.png',
          notify: false);
    } else {
      final path = _initialPath;
      if (path != null) {
        File(path)
            .readAsBytes()
            .then((b) => _load(b, fileNameOf(path)))
            .catchError((Object e) {
          if (mounted) {
            setState(() =>
                _error = t('No se pudo abrir $path', 'Could not open $path'));
          }
        });
      }
    }
    if (_bench) {
      WidgetsBinding.instance
          .addPostFrameCallback((_) => _openLibrary(bench: LibraryBench()));
    }
  }

  Uint8List? _bytes;
  OimExtractionResult? _result;
  Map<String, dynamic>? _normalizedMeta;
  OimSecurityStatus? _status;
  String _fileName = 'OIM Viewer';
  String _language = '';
  String? _palette;
  bool _showLayers = true;
  bool _allowLottie = true;
  bool _playMotion = true;
  // Open beside the work on wide screens; on a phone it would cover it.
  late bool _inspectorOpen = MediaQuery.sizeOf(context).width >= 720;
  String? _error;
  final _library = LibraryClient();
  // Phone viewer: bars over the work that a tap hides, details in a sheet below.
  bool _chrome = true;
  final _sheet = DraggableScrollableController();

  void _openDetails() => _sheet.animateTo(0.6,
      duration: const Duration(milliseconds: 250), curve: Curves.easeOutCubic);

  @override
  void dispose() {
    _sheet.dispose();
    super.dispose();
  }

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

  Map<String, dynamic>? get _meta => _normalizedMeta;

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

  void _load(Uint8List bytes, String name, {bool notify = true}) {
    void update(VoidCallback fn) {
      if (notify) {
        setState(fn);
      } else {
        fn();
      }
    }

    try {
      final result = extractOIM(bytes);
      final status = verifyOim(result);
      if (isRefused(status)) {
        // An altered file is not shown: neither its image nor its layers.
        update(() => _error = t(
            'Archivo alterado (${_badgeFor(status).text}): no se muestra.',
            'File altered (${_badgeFor(status).text}): not shown.'));
        return;
      }
      final meta = normalizeV2Metadata(result.metadata);
      final langs = <String>[
        ...?((meta['languages'] as List?)?.map((e) => e.toString())),
      ];
      if (langs.isEmpty) {
        for (final slot in (meta['slots'] as List? ?? const [])) {
          final content = slot is Map ? slot['content'] : null;
          if (content is Map) {
            for (final k in content.keys) {
              final key = k.toString();
              if (key != '*' && !langs.contains(key)) langs.add(key);
            }
          }
        }
      }
      final pals = (meta['palettes'] as Map?)
              ?.keys
              .map((e) => e.toString())
              .toList() ??
          const <String>[];
      final defaultPal = meta['defaultPalette']?.toString();
      update(() {
        _bytes = bytes;
        _result = result;
        _normalizedMeta = meta;
        _status = status;
        _fileName = name;
        _language = langs.isNotEmpty ? langs.first : '';
        _palette = (defaultPal != null && pals.contains(defaultPal))
            ? defaultPal
            : (pals.isNotEmpty ? pals.first : null);
        _error = null;
      });
    } catch (e) {
      update(() => _error = t('No se pudo leer el archivo OIM: $e',
          'Could not read the OIM file: $e'));
    }
  }

  Widget _details({required bool sheet, ScrollController? scroll}) =>
      _InspectorDrawer(
        sheet: sheet,
        scroll: scroll,
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
        onToggleLayers: () => setState(() => _showLayers = !_showLayers),
        onToggleLottie: () => setState(() => _allowLottie = !_allowLottie),
        onToggleMotion: () => setState(() => _playMotion = !_playMotion),
        onSelectLanguage: (l) => setState(() => _language = l),
        onSelectPalette: (p) => setState(() => _palette = p),
      );

  /// Phone, with a file: the work fills the screen like a photo in a gallery.
  /// A tap shows or hides the bars; swiping up (or the info button) raises the details.
  Widget _phoneViewer(Widget topBar) {
    final player = OimPlayer(
      bytes: _bytes!,
      language: _language.isEmpty ? null : _language,
      palette: _palette,
      isInteractive: _showLayers,
      allowLottie: _allowLottie,
      disableAnimations: !_playMotion,
    );
    // Back closes the details first, like the gallery app, instead of leaving.
    final detailsOpen = _sheet.isAttached && _sheet.size > 0.01;
    return PopScope(
        canPop: !detailsOpen,
        onPopInvokedWithResult: (didPop, _) {
          if (!didPop) {
            _sheet.animateTo(0,
                duration: const Duration(milliseconds: 150),
                curve: Curves.easeOutCubic);
          }
        },
        child: NotificationListener<DraggableScrollableNotification>(
            // Rebuild when the sheet opens or closes so Back knows where it stands.
            onNotification: (n) {
              if ((n.extent > 0.01) != detailsOpen) setState(() {});
              return false;
            },
            child: Stack(children: [
              Positioned.fill(
                child: GestureDetector(
                  behavior: HitTestBehavior.translucent,
                  onTap: () => setState(() => _chrome = !_chrome),
                  onVerticalDragEnd: (d) {
                    if ((d.primaryVelocity ?? 0) < -300) _openDetails();
                  },
                  child: Center(child: player),
                ),
              ),
              Positioned(
                  top: 0,
                  left: 0,
                  right: 0,
                  child: _Fade(visible: _chrome, child: topBar)),
              Positioned(
                left: 0,
                right: 0,
                bottom: 0,
                child: _Fade(
                  visible: _chrome,
                  child: _QuickActions(children: [
                    _BarButton(
                        icon: _showLayers ? Icons.layers : Icons.layers_clear,
                        label: t('Capa interactiva', 'Interactive layer'),
                        active: _showLayers,
                        compact: true,
                        onTap: () =>
                            setState(() => _showLayers = !_showLayers)),
                    _BarButton(
                        icon: _playMotion ? Icons.pause : Icons.play_arrow,
                        label: _playMotion
                            ? t('Pausar movimiento', 'Pause motion')
                            : t('Reproducir movimiento', 'Play motion'),
                        compact: true,
                        onTap: () =>
                            setState(() => _playMotion = !_playMotion)),
                    _BarButton(
                        icon: Icons.info_outline,
                        label: t('Detalles', 'Details'),
                        compact: true,
                        onTap: _openDetails),
                  ]),
                ),
              ),
              DraggableScrollableSheet(
                controller: _sheet,
                initialChildSize: 0,
                minChildSize: 0,
                maxChildSize: 0.9,
                snap: true,
                snapSizes: const [0.6],
                builder: (context, scroll) =>
                    _details(sheet: true, scroll: scroll),
              ),
            ])));
  }

  @override
  Widget build(BuildContext context) {
    final phone = MediaQuery.sizeOf(context).width < 600 && _bytes != null;
    final topBar = _TopBar(
      fileName: _fileName,
      sizeLabel: _bytes == null ? null : _formatSize(_bytes!.length),
      status: _status,
      hasFile: _bytes != null,
      inspectorOpen: _inspectorOpen,
      palettes: _palettes,
      selectedPalette: _palette,
      onSelectPalette: (p) => setState(() => _palette = p),
      onOpen: _pickFile,
      onToggleInspector: () => setState(() => _inspectorOpen = !_inspectorOpen),
      onLibrary: _openLibrary,
    );
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
                child: SafeArea(
                    child: phone
                        ? _phoneViewer(topBar)
                        : Column(
                            children: [
                              topBar,
                              if (_error != null)
                                Container(
                                  width: double.infinity,
                                  color: const Color(0x33EF4444),
                                  padding: const EdgeInsets.symmetric(
                                      horizontal: 14, vertical: 6),
                                  child: Text(_error!,
                                      style: const TextStyle(
                                          color: Color(0xFFFCA5A5),
                                          fontSize: kFontBody)),
                                ),
                              Expanded(
                                child: LayoutBuilder(
                                  builder: (context, c) {
                                    final wide = c.maxWidth >= 720;
                                    final drawerVisible =
                                        _inspectorOpen && _result != null;
                                    final stage = _bytes == null
                                        ? _EmptyState(
                                            onOpen: _pickFile,
                                            onLibrary: _openLibrary)
                                        : Padding(
                                            padding: const EdgeInsets.all(20),
                                            child: Center(
                                              child: ClipRRect(
                                                borderRadius:
                                                    BorderRadius.circular(10),
                                                child: OimPlayer(
                                                  bytes: _bytes!,
                                                  language: _language.isEmpty
                                                      ? null
                                                      : _language,
                                                  palette: _palette,
                                                  isInteractive: _showLayers,
                                                  allowLottie: _allowLottie,
                                                  disableAnimations:
                                                      !_playMotion,
                                                ),
                                              ),
                                            ),
                                          );
                                    final drawer = drawerVisible
                                        ? _details(sheet: !wide)
                                        : null;
                                    if (drawer == null) return stage;
                                    if (wide) {
                                      return Row(children: [
                                        Expanded(child: stage),
                                        drawer
                                      ]);
                                    }
                                    return Stack(children: [
                                      stage,
                                      Positioned(
                                          top: 0,
                                          bottom: 0,
                                          right: 0,
                                          child: drawer)
                                    ]);
                                  },
                                ),
                              ),
                            ],
                          )),
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
      return _Badge(
          t('Firmado · sin autoría', 'Signed · no authorship'), _signed);
    case OimSecurityStatus.imageUnsealed:
      return _Badge(t('Firmado · sin sello', 'Signed · unsealed'),
          const Color(0xFFCBD5E1));
    case OimSecurityStatus.expiredKey:
      return _Badge(t('Clave expirada', 'Expired key'), kWarning);
    case OimSecurityStatus.unknownKey:
      return _Badge(t('Clave desconocida', 'Unknown key'), kWarning);
    case OimSecurityStatus.imageMismatch:
      return _Badge(t('Imagen alterada', 'Image altered'), kDanger);
    case OimSecurityStatus.invalidSignature:
      return _Badge(t('Firma inválida', 'Invalid signature'), kDanger);
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
    // On a phone the labels do not fit beside the title: icons, with the label read by TalkBack.
    final compact = MediaQuery.sizeOf(context).width < 600;
    return Container(
      height: 56,
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
          Expanded(
            child: Text(
              hasFile ? _compactTitle(fileName, 18) : 'OIM Viewer',
              overflow: TextOverflow.ellipsis,
              style: const TextStyle(
                  fontSize: kFontTitle,
                  fontWeight: FontWeight.w600,
                  color: _textSoft),
            ),
          ),
          const SizedBox(width: 8),
          if (sizeLabel != null && !compact) ...[
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 3),
              decoration: BoxDecoration(
                color: _chipBg,
                border: Border.all(color: _border),
                borderRadius: BorderRadius.circular(6),
              ),
              child: Text(sizeLabel!,
                  style: _mono.copyWith(
                      fontSize: kFontSmall, color: _textSecondary)),
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
                    height: kMinTarget,
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
                            fontSize: kFontSmall,
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
                constraints: const BoxConstraints(minHeight: kMinTarget),
                padding: const EdgeInsets.symmetric(horizontal: 10),
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
                          fontSize: kFontSmall,
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
              compact: compact,
              onTap: onLibrary),
          const SizedBox(width: 2),
          _BarButton(
              icon: Icons.folder_open_outlined,
              label: hasFile
                  ? t('Cargar otro', 'Load another')
                  : t('Abrir', 'Open'),
              compact: compact,
              onTap: onOpen),
          if (hasFile && !compact) ...[
            const SizedBox(width: 2),
            _BarButton(
                icon: Icons.tune,
                label: t('Ajustes', 'Settings'),
                active: inspectorOpen,
                compact: compact,
                onTap: onToggleInspector),
          ],
        ],
      ),
    );
  }
}

/// A 48 dp touch target around a smaller visible chip, announced as a button.
class _Target extends StatelessWidget {
  const _Target(
      {required this.label,
      required this.onTap,
      required this.child,
      this.selected});

  final String label;
  final VoidCallback onTap;
  final Widget child;
  final bool? selected;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      button: true,
      selected: selected,
      label: label,
      excludeSemantics: true,
      child: InkWell(
        borderRadius: BorderRadius.circular(8),
        onTap: onTap,
        child: ConstrainedBox(
          constraints:
              const BoxConstraints(minHeight: kMinTarget, minWidth: kMinTarget),
          child: Center(widthFactor: 1, child: child),
        ),
      ),
    );
  }
}

class _BarButton extends StatelessWidget {
  const _BarButton(
      {required this.icon,
      required this.label,
      required this.onTap,
      this.active = false,
      this.compact = false});

  final IconData icon;
  final String label;
  final VoidCallback onTap;
  final bool active;
  final bool compact;

  @override
  Widget build(BuildContext context) {
    final fg = active ? _bg : _textSoft;
    return _Target(
      label: label,
      selected: active,
      onTap: onTap,
      child: Container(
        padding:
            EdgeInsets.symmetric(horizontal: compact ? 8 : 10, vertical: 8),
        decoration: BoxDecoration(
          color: active ? Colors.white : _chipBg,
          border: Border.all(color: active ? Colors.white : _chipBorder),
          borderRadius: BorderRadius.circular(7),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(icon, size: 18, color: fg),
            if (!compact) ...[
              const SizedBox(width: 6),
              Text(label,
                  style: TextStyle(
                      fontSize: kFontBody,
                      color: fg,
                      fontWeight: active ? FontWeight.w700 : FontWeight.w500)),
            ],
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
                  fontSize: kFontHeading,
                  color: _text,
                  fontWeight: FontWeight.w600)),
          const SizedBox(height: 6),
          Text(
              t('Se lee y se dibuja de forma nativa, sin navegador.',
                  'Read and drawn natively, no browser.'),
              style: const TextStyle(fontSize: kFontBody, color: _textMuted)),
          const SizedBox(height: 18),
          _Target(
            label: t('Cargar archivo', 'Load file'),
            onTap: onOpen,
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 12),
              decoration: BoxDecoration(
                  color: Colors.white, borderRadius: BorderRadius.circular(8)),
              child: Text(t('Cargar archivo', 'Load file'),
                  style: const TextStyle(
                      color: _bg,
                      fontSize: kFontBody,
                      fontWeight: FontWeight.w700)),
            ),
          ),
          const SizedBox(height: 10),
          TextButton(
              onPressed: onLibrary,
              child: Text(
                  t('Explorar la biblioteca pública',
                      'Browse the public library'),
                  style: const TextStyle(
                      color: _textSecondary, fontSize: kFontBody))),
        ],
      ),
    );
  }
}

class _InspectorDrawer extends StatelessWidget {
  const _InspectorDrawer({
    this.sheet = false,
    this.scroll,
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

  final bool sheet;
  final ScrollController? scroll;
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
    final w = canvas?['natural_width'] ?? canvas?['width'];
    final h = canvas?['natural_height'] ?? canvas?['height'];
    String fmtDim(Object n) =>
        n is num && n == n.roundToDouble() ? '${n.round()}' : '$n';
    final dims =
        (w != null && h != null) ? '${fmtDim(w)} × ${fmtDim(h)} px' : 'Responsive';
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
      width: sheet ? double.infinity : 290,
      decoration: BoxDecoration(
        color: sheet ? _bgCenter : _drawerBg,
        borderRadius: sheet
            ? const BorderRadius.vertical(top: Radius.circular(16))
            : null,
        border: sheet
            ? const Border(top: BorderSide(color: _border))
            : const Border(left: BorderSide(color: _border)),
      ),
      child: ListView(
        controller: scroll,
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 16),
        children: [
          if (sheet)
            Center(
              child: Container(
                width: 36,
                height: 4,
                margin: const EdgeInsets.only(bottom: 16),
                decoration: BoxDecoration(
                    color: _textMuted, borderRadius: BorderRadius.circular(2)),
              ),
            ),
          _SectionHeader(
              title: t('AJUSTES', 'SETTINGS'),
              trailing: '${slots.length} slots'),
          const SizedBox(height: 12),
          Row(
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(t('Capa interactiva', 'Interactive layer'),
                        style: const TextStyle(
                            fontSize: kFontBody,
                            color: _text,
                            fontWeight: FontWeight.w500)),
                    Text(
                        showLayers
                            ? t('Superposición activa', 'Overlay on')
                            : t('Base PNG plana', 'Flat PNG base'),
                        style: const TextStyle(
                            fontSize: kFontSmall, color: _textMuted)),
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
                              fontSize: kFontBody,
                              color: _text,
                              fontWeight: FontWeight.w500)),
                      Text(
                          allowLottie
                              ? t('Reproduciendo', 'Playing')
                              : t('Desactivado', 'Off'),
                          style: const TextStyle(
                              fontSize: kFontSmall, color: _textMuted)),
                    ],
                  ),
                ),
                _Toggle(
                  icon: allowLottie
                      ? Icons.play_circle_outline
                      : Icons.pause_circle_outline,
                  label:
                      allowLottie ? t('Activo', 'On') : t('Pausado', 'Paused'),
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
                              fontSize: kFontBody,
                              color: _text,
                              fontWeight: FontWeight.w500)),
                      Text(
                          playMotion
                              ? t('Bucle en vivo', 'Live loop')
                              : t('Pausado', 'Paused'),
                          style: const TextStyle(
                              fontSize: kFontSmall, color: _textMuted)),
                    ],
                  ),
                ),
                _Toggle(
                  icon: playMotion ? Icons.animation : Icons.motion_photos_off,
                  label:
                      playMotion ? t('Activo', 'On') : t('Pausado', 'Paused'),
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
                    fontSize: kFontBody,
                    color: _text,
                    fontWeight: FontWeight.w500)),
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
                    fontSize: kFontBody,
                    color: _text,
                    fontWeight: FontWeight.w500)),
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
              title: t('FICHA TÉCNICA', 'DETAILS'),
              trailing: schemaVersionOf(meta)),
          const SizedBox(height: 12),
          _SpecRow(label: t('Archivo', 'File'), value: fileName, mono: true),
          _SpecRow(label: t('Peso', 'Size'), value: sizeLabel, mono: true),
          _SpecRow(label: t('Resolución', 'Resolution'), value: dims),
          _SpecRow(
              label: t('Esquema OIM', 'OIM schema'),
              value: schemaVersionOf(meta),
              mono: true),
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
                style:
                    const TextStyle(fontSize: kFontSmall, color: _textMuted)),
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
                            fontSize: kFontSmall, color: _textSoft),
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
                  fontSize: kFontSmall,
                  color: _textSecondary,
                  fontWeight: FontWeight.w700,
                  letterSpacing: 0.66)),
          Text(trailing,
              style: _mono.copyWith(fontSize: kFontSmall, color: _textMuted)),
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
    return _Target(
      label: label,
      selected: active,
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
        decoration: BoxDecoration(
          color: active ? Colors.white : Colors.transparent,
          border: Border.all(
              color: active ? Colors.white : const Color(0x1FFFFFFF)),
          borderRadius: BorderRadius.circular(6),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(icon, size: 16, color: fg),
            const SizedBox(width: 6),
            Text(label,
                style: TextStyle(
                    fontSize: kFontBody,
                    color: fg,
                    fontWeight: FontWeight.w600)),
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
    return _Target(
      label: label,
      selected: active,
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
        decoration: BoxDecoration(
          color: active ? Colors.white : Colors.transparent,
          border: Border.all(color: active ? Colors.white : _chipBorder),
          borderRadius: BorderRadius.circular(5),
        ),
        child: Text(label,
            style: TextStyle(
                fontSize: kFontSmall,
                fontWeight: FontWeight.w600,
                color: active ? _bg : _textSoft)),
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
        .copyWith(fontSize: kFontSmall, color: valueColor ?? _text);
    return Padding(
      padding: const EdgeInsets.only(bottom: 9),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.baseline,
        textBaseline: TextBaseline.alphabetic,
        children: [
          Text(label,
              style: const TextStyle(fontSize: kFontSmall, color: _textMuted)),
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

class _Fade extends StatelessWidget {
  const _Fade({required this.visible, required this.child});

  final bool visible;
  final Widget child;

  @override
  Widget build(BuildContext context) => IgnorePointer(
        ignoring: !visible,
        child: AnimatedOpacity(
            opacity: visible ? 1 : 0,
            duration: const Duration(milliseconds: 150),
            child: child),
      );
}

class _QuickActions extends StatelessWidget {
  const _QuickActions({required this.children});

  final List<Widget> children;

  @override
  Widget build(BuildContext context) => Container(
        width: double.infinity,
        padding: const EdgeInsets.symmetric(vertical: 8),
        decoration: const BoxDecoration(
          color: kTopBarBg,
          border: Border(top: BorderSide(color: _border)),
        ),
        child: Row(
            mainAxisAlignment: MainAxisAlignment.spaceEvenly,
            children: children),
      );
}
