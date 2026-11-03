// Copyright (c) 2026 Xue Studios LLC
// SPDX-License-Identifier: Apache-2.0

import 'dart:io';
import 'dart:typed_data';
import 'package:flutter/material.dart';
import 'package:file_picker/file_picker.dart';
import 'package:oim_flutter/oim_flutter.dart';

void main() {
  runApp(const OimViewerApp());
}

class OimViewerApp extends StatelessWidget {
  const OimViewerApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'OIM Viewer Flutter',
      debugShowCheckedModeBanner: false,
      theme: ThemeData.dark().copyWith(
        scaffoldBackgroundColor: const Color(0xFF0D0F12),
        appBarTheme: const AppBarTheme(
          backgroundColor: Color(0xFF14171C),
          elevation: 0,
        ),
        colorScheme: const ColorScheme.dark(
          primary: Color(0xFFF59E0B),
          surface: Color(0xFF14171C),
        ),
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
  Uint8List? _oimBytes;
  String _currentTitle = 'Ningún archivo cargado';
  String _selectedLanguage = 'es';
  bool _isInteractive = true;
  Map<String, dynamic>? _metadata;
  String? _statusMessage;

  final List<String> _sampleVectors = [
    'basic-text.oim.png',
    'typography-styling.oim.png',
    'multilang-cjk-rtl.oim.png',
    'interactive.oim.png',
    'filter-effects.oim.png',
    'accessibility.oim.png',
  ];

  @override
  void initState() {
    super.initState();
    _loadDefaultVector();
  }

  void _loadDefaultVector() {
    // Attempt to load from relative spec/vectors path in desktop environment
    try {
      const samplePath = '../../packages/spec/vectors/typography-styling.oim.png';
      final file = File(samplePath);
      if (file.existsSync()) {
        final bytes = file.readAsBytesSync();
        _setOimBytes(bytes, 'typography-styling.oim.png');
      }
    } catch (_) {
      // Ignored if running in an environment without direct filesystem relative access
    }
  }

  void _setOimBytes(Uint8List bytes, String title) {
    try {
      final result = extractOIM(bytes);
      setState(() {
        _oimBytes = bytes;
        _currentTitle = title;
        _metadata = result.metadata;
        final langs = (result.metadata['languages'] as List<dynamic>?)?.map((e) => e.toString()).toList();
        if (langs != null && langs.isNotEmpty && !langs.contains(_selectedLanguage)) {
          _selectedLanguage = langs.first;
        }
        _statusMessage = null;
      });
    } catch (e) {
      setState(() {
        _statusMessage = 'Error al leer el archivo OIM: $e';
      });
    }
  }

  Future<void> _pickFile() async {
    final result = await FilePicker.platform.pickFiles(
      type: FileType.custom,
      allowedExtensions: ['png', 'oim'],
      withData: true,
    );

    if (result != null && result.files.isNotEmpty) {
      final file = result.files.first;
      Uint8List? bytes = file.bytes;
      if (bytes == null && file.path != null) {
        bytes = File(file.path!).readAsBytesSync();
      }
      if (bytes != null) {
        _setOimBytes(bytes, file.name);
      }
    }
  }

  void _loadSampleVector(String filename) {
    try {
      final path = '../../packages/spec/vectors/$filename';
      final file = File(path);
      if (file.existsSync()) {
        final bytes = file.readAsBytesSync();
        _setOimBytes(bytes, filename);
      } else {
        setState(() {
          _statusMessage = 'Vector no encontrado en la ruta: $path';
        });
      }
    } catch (e) {
      setState(() {
        _statusMessage = 'Error al cargar el vector: $e';
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final availableLanguages = <String>{'es', 'en'};
    if (_metadata != null && _metadata!['languages'] is List) {
      for (final l in _metadata!['languages'] as List) {
        availableLanguages.add(l.toString());
      }
    }

    return Scaffold(
      appBar: AppBar(
        title: Row(
          children: [
            const Icon(Icons.layers_outlined, color: Color(0xFFF59E0B), size: 22),
            const SizedBox(width: 8),
            Expanded(
              child: Text(
                _currentTitle,
                style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w600),
                overflow: TextOverflow.ellipsis,
              ),
            ),
          ],
        ),
        actions: [
          // Language selector
          if (_oimBytes != null) ...[
            DropdownButton<String>(
              value: availableLanguages.contains(_selectedLanguage) ? _selectedLanguage : availableLanguages.first,
              dropdownColor: const Color(0xFF1E222A),
              underline: const SizedBox(),
              items: availableLanguages.map((lang) {
                return DropdownMenuItem(
                  value: lang,
                  child: Text(
                    lang.toUpperCase(),
                    style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13),
                  ),
                );
              }).toList(),
              onChanged: (val) {
                if (val != null) {
                  setState(() => _selectedLanguage = val);
                }
              },
            ),
            const SizedBox(width: 8),

            // Toggle interactive layers
            IconButton(
              tooltip: _isInteractive ? 'Ocultar capa interactiva' : 'Mostrar capa interactiva',
              icon: Icon(
                _isInteractive ? Icons.visibility : Icons.visibility_off,
                color: _isInteractive ? const Color(0xFFF59E0B) : Colors.grey,
              ),
              onPressed: () {
                setState(() => _isInteractive = !_isInteractive);
              },
            ),
          ],

          // Pick sample vector dropdown menu
          PopupMenuButton<String>(
            tooltip: 'Probar vectores canónicos',
            icon: const Icon(Icons.palette_outlined),
            onSelected: _loadSampleVector,
            itemBuilder: (context) {
              return _sampleVectors.map((v) {
                return PopupMenuItem(
                  value: v,
                  child: Text(v, style: const TextStyle(fontSize: 13)),
                );
              }).toList();
            },
          ),

          // File open button
          Padding(
            padding: const EdgeInsets.only(right: 12, left: 4),
            child: ElevatedButton.icon(
              style: ElevatedButton.styleFrom(
                backgroundColor: const Color(0xFFF59E0B),
                foregroundColor: Colors.black,
                padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
              ),
              icon: const Icon(Icons.file_open, size: 16),
              label: const Text('Abrir .oim', style: TextStyle(fontWeight: FontWeight.bold)),
              onPressed: _pickFile,
            ),
          ),
        ],
      ),
      body: Column(
        children: [
          if (_statusMessage != null)
            Container(
              width: double.infinity,
              color: Colors.red.shade900,
              padding: const EdgeInsets.all(8),
              child: Text(
                _statusMessage!,
                style: const TextStyle(color: Colors.white, fontSize: 13),
                textAlign: TextAlign.center,
              ),
            ),
          Expanded(
            child: Center(
              child: _oimBytes != null
                  ? Container(
                      margin: const EdgeInsets.all(24),
                      decoration: BoxDecoration(
                        boxShadow: const [
                          BoxShadow(
                            color: Colors.black54,
                            blurRadius: 30,
                            spreadRadius: 5,
                          ),
                        ],
                        borderRadius: BorderRadius.circular(12),
                      ),
                      clipBehavior: Clip.antiAlias,
                      child: OimPlayer(
                        bytes: _oimBytes!,
                        language: _selectedLanguage,
                        isInteractive: _isInteractive,
                      ),
                    )
                  : Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        const Icon(Icons.image_outlined, size: 64, color: Colors.grey),
                        const SizedBox(height: 16),
                        const Text(
                          'Selecciona o abre un archivo .oim para comenzar',
                          style: TextStyle(color: Colors.grey, fontSize: 16),
                        ),
                        const SizedBox(height: 16),
                        ElevatedButton.icon(
                          style: ElevatedButton.styleFrom(
                            backgroundColor: const Color(0xFFF59E0B),
                            foregroundColor: Colors.black,
                          ),
                          icon: const Icon(Icons.file_open),
                          label: const Text('Explorar archivos'),
                          onPressed: _pickFile,
                        ),
                      ],
                    ),
            ),
          ),
        ],
      ),
    );
  }
}
