// Copyright (c) 2026 Xue Studios LLC
// SPDX-License-Identifier: Apache-2.0

import 'dart:typed_data';
import 'package:flutter/material.dart';
import 'package:oim_flutter/oim_flutter.dart';
import '../ui/tokens.dart';
import 'library_client.dart';

/// A library card: the flattened thumbnail, and the work itself only while hovered
/// (downloaded and verified on the first hover). A refused file never shows its layers.
class LibraryCard extends StatefulWidget {
  final LibraryItem item;
  final LibraryClient client;
  final bool live;
  final void Function(LibraryItem item, Uint8List bytes) onOpen;
  const LibraryCard({super.key, required this.item, required this.client, required this.onOpen, this.live = true});

  @override
  State<LibraryCard> createState() => _LibraryCardState();
}

class _LibraryCardState extends State<LibraryCard> {
  Uint8List? _bytes;
  bool _refused = false;
  bool _hovered = false;
  bool _loading = false;

  void _onHover(bool hovered) {
    setState(() => _hovered = hovered);
    // A whole grid of live players costs every file's download and composition; only the hovered one pays it.
    if (hovered && widget.live && _bytes == null && !_refused && !_loading) {
      _loading = true;
      _load();
    }
  }

  Future<void> _load() async {
    try {
      final bytes = await widget.client.fetchBytes(widget.item.mediaUrl);
      final refused = isRefused(verifyOim(extractOIM(bytes)));
      if (!mounted) return;
      setState(() {
        _refused = refused;
        _bytes = refused ? null : bytes;
      });
    } catch (_) {
      // The thumbnail stays; opening the card retries the download.
    } finally {
      _loading = false;
    }
  }

  Future<void> _open() async {
    if (_refused) return;
    final bytes = _bytes ?? await widget.client.fetchBytes(widget.item.mediaUrl);
    widget.onOpen(widget.item, bytes);
  }

  @override
  Widget build(BuildContext context) {
    final thumb = widget.item.thumbnailUrl;
    Widget body;
    if (_bytes != null && _hovered) {
      body = OimPlayer(bytes: _bytes!, isInteractive: false);
    } else if (thumb != null && thumb.isNotEmpty) {
      body = Image.network(thumb, fit: BoxFit.cover, errorBuilder: (context, error, stack) => const SizedBox());
    } else {
      body = const SizedBox();
    }
    return Semantics(
      button: true,
      label: widget.item.title,
      child: MouseRegion(
        cursor: _refused ? SystemMouseCursors.basic : SystemMouseCursors.click,
        onEnter: (_) => _onHover(true),
        onExit: (_) => _onHover(false),
        child: GestureDetector(
          onTap: _open,
          child: Container(
            decoration: BoxDecoration(
              color: kBgCenter,
              borderRadius: BorderRadius.circular(8),
              border: Border.all(color: _hovered ? kChipBorder : kBorder),
            ),
            clipBehavior: Clip.antiAlias,
            child: Stack(fit: StackFit.expand, children: [
              body,
              if (_refused)
                const Center(child: Icon(Icons.lock_outline, color: kWarning, size: 28, semanticLabel: 'Archivo alterado')),
              Positioned(
                left: 0,
                right: 0,
                bottom: 0,
                child: AnimatedOpacity(
                  opacity: _hovered ? 1 : 0,
                  duration: const Duration(milliseconds: 150),
                  child: Container(
                    padding: const EdgeInsets.fromLTRB(10, 16, 10, 8),
                    decoration: const BoxDecoration(
                      gradient: LinearGradient(
                        begin: Alignment.topCenter,
                        end: Alignment.bottomCenter,
                        colors: [Color(0x00000000), Color(0xCC000000)],
                      ),
                    ),
                    child: Text(widget.item.title,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: const TextStyle(color: kText, fontSize: 12, fontWeight: FontWeight.w600)),
                  ),
                ),
              ),
            ]),
          ),
        ),
      ),
    );
  }
}
