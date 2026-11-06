// Copyright (c) 2026 Xue Studios LLC
// SPDX-License-Identifier: Apache-2.0

import 'library_client.dart';

/// Search and category as in the Tauri library (`applyFilter`).
List<LibraryItem> filterItems(List<LibraryItem> items, String query, String category) {
  final q = query.trim().toLowerCase();
  return items.where((it) {
    if (category != 'all' && !(it.category?.toLowerCase().contains(category.toLowerCase()) ?? false)) return false;
    if (q.isEmpty) return true;
    return it.title.toLowerCase().contains(q) || (it.titleEn?.toLowerCase().contains(q) ?? false);
  }).toList();
}

class LibraryRow {
  final List<LibraryItem> items;
  final double height;
  const LibraryRow(this.items, this.height);
}

/// Rows of equal height that fill the width, each item at its own aspect ratio.
/// Rows (unlike Tauri's masonry columns) let a lazy list build only what is on screen.
List<LibraryRow> justifiedRows(List<LibraryItem> items, {required double width, double targetHeight = 220, double gap = 8}) {
  final rows = <LibraryRow>[];
  var current = <LibraryItem>[];
  var ratioSum = 0.0;
  for (final it in items) {
    current.add(it);
    ratioSum += it.aspectRatio;
    final height = (width - gap * (current.length - 1)) / ratioSum;
    if (height <= targetHeight) {
      rows.add(LibraryRow(current, height));
      current = [];
      ratioSum = 0;
    }
  }
  if (current.isNotEmpty) rows.add(LibraryRow(current, targetHeight));
  return rows;
}
