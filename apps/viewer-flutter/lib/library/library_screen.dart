// Copyright (c) 2026 Xue Studios LLC
// SPDX-License-Identifier: Apache-2.0

import 'dart:typed_data';
import 'package:flutter/material.dart';
import '../ui/tokens.dart';
import 'library_card.dart';
import 'library_client.dart';
import 'library_layout.dart';

const _categories = [
  ('all', 'Todas'),
  ('ui', 'UI & Dashboards'),
  ('marketing', 'Marketing'),
  ('arte', 'Arte'),
  ('tipografia', 'Tipografía'),
];

class LibraryScreen extends StatefulWidget {
  final LibraryClient client;
  final void Function(LibraryItem item, Uint8List bytes) onOpen;

  /// Off in widget tests, where the cards have no network.
  final bool loadCards;
  const LibraryScreen({super.key, required this.client, required this.onOpen, this.loadCards = true});

  @override
  State<LibraryScreen> createState() => _LibraryScreenState();
}

class _LibraryScreenState extends State<LibraryScreen> {
  List<LibraryItem> _items = const [];
  String _query = '';
  String _category = 'all';
  bool _loading = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    _fetch();
  }

  Future<void> _fetch({bool force = false}) async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final items = await widget.client.fetchItems(force: force);
      if (mounted) setState(() => _items = items);
    } on LibraryException catch (e) {
      if (mounted) setState(() => _error = e.message);
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final shown = filterItems(_items, _query, _category);
    return Scaffold(
      backgroundColor: kBg,
      appBar: AppBar(
        backgroundColor: kBg,
        foregroundColor: kText,
        elevation: 0,
        title: const Text('Biblioteca', style: TextStyle(fontSize: 15, fontWeight: FontWeight.w600)),
        bottom: const PreferredSize(preferredSize: Size.fromHeight(1), child: Divider(height: 1, color: kBorder)),
      ),
      body: Column(children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 12, 16, 8),
          child: Row(children: [
            Expanded(
              child: TextField(
                onChanged: (v) => setState(() => _query = v),
                style: const TextStyle(color: kText, fontSize: 13),
                decoration: InputDecoration(
                  hintText: 'Buscar obra...',
                  hintStyle: const TextStyle(color: kTextMuted),
                  prefixIcon: const Icon(Icons.search, size: 18, color: kTextSecondary),
                  isDense: true,
                  filled: true,
                  fillColor: kChipBg,
                  border: OutlineInputBorder(borderRadius: BorderRadius.circular(8), borderSide: const BorderSide(color: kChipBorder)),
                  enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(8), borderSide: const BorderSide(color: kChipBorder)),
                ),
              ),
            ),
            const SizedBox(width: 12),
            Text('${shown.length} obras', style: kMono.copyWith(fontSize: 11, color: kTextSecondary)),
          ]),
        ),
        SizedBox(
          height: 36,
          child: ListView(
            scrollDirection: Axis.horizontal,
            padding: const EdgeInsets.symmetric(horizontal: 16),
            children: [
              for (final (id, label) in _categories)
                Padding(
                  padding: const EdgeInsets.only(right: 6),
                  child: ChoiceChip(
                    label: Text(label, style: TextStyle(fontSize: 11, color: _category == id ? kBg : kTextSecondary)),
                    selected: _category == id,
                    selectedColor: kText,
                    backgroundColor: kChipBg,
                    side: const BorderSide(color: kChipBorder),
                    showCheckmark: false,
                    onSelected: (_) => setState(() => _category = id),
                  ),
                ),
            ],
          ),
        ),
        Expanded(child: _body(shown)),
      ]),
    );
  }

  Widget _body(List<LibraryItem> shown) {
    if (_loading && _items.isEmpty) {
      return const Center(child: Text('Cargando obras...', style: TextStyle(color: kTextMuted, fontSize: 12)));
    }
    if (_error != null) {
      return Center(
        child: Column(mainAxisSize: MainAxisSize.min, children: [
          const Text('No se pudo cargar la biblioteca. Revisa la conexión.', style: TextStyle(color: kTextSecondary, fontSize: 12)),
          const SizedBox(height: 12),
          OutlinedButton(onPressed: () => _fetch(force: true), child: const Text('Reintentar')),
        ]),
      );
    }
    if (shown.isEmpty) {
      return const Center(child: Text('Sin resultados. Intenta buscar con otros términos.', style: TextStyle(color: kTextMuted, fontSize: 12)));
    }
    return LayoutBuilder(builder: (context, box) {
      const pad = 16.0, gap = 8.0;
      final rows = justifiedRows(shown, width: box.maxWidth - pad * 2, gap: gap);
      return ListView.builder(
        padding: const EdgeInsets.fromLTRB(pad, 8, pad, pad),
        itemCount: rows.length,
        itemBuilder: (context, i) {
          final row = rows[i];
          return Padding(
            padding: const EdgeInsets.only(bottom: gap),
            child: SizedBox(
              height: row.height,
              child: Row(children: [
                for (var j = 0; j < row.items.length; j++) ...[
                  if (j > 0) const SizedBox(width: gap),
                  SizedBox(
                    width: row.items[j].aspectRatio * row.height,
                    child: LibraryCard(
                      key: ValueKey(row.items[j].id),
                      item: row.items[j],
                      client: widget.client,
                      onOpen: widget.onOpen,
                      live: widget.loadCards,
                    ),
                  ),
                ],
              ]),
            ),
          );
        },
      );
    });
  }
}
