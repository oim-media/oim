// Copyright (c) 2026 Xue Studios LLC
// SPDX-License-Identifier: Apache-2.0

// `oim_viewer_flutter --library-bench`: opens the library, scrolls it to the end
// and back, and writes frame times and memory to stdout and to %TEMP%/oim-library-bench.txt. Used for the
// performance gate in docs/superpowers/plans/2026-11-05-flutter-viewer-library.md.

import 'dart:io';
import 'package:flutter/scheduler.dart';
import 'package:flutter/widgets.dart';

class LibraryBench {
  final _timings = <FrameTiming>[];

  void start() => SchedulerBinding.instance.addTimingsCallback(_timings.addAll);

  /// Scrolls the first scrollable under [context] down and back up.
  Future<void> run(ScrollController controller) async {
    await Future<void>.delayed(const Duration(seconds: 4)); // list and first cards
    final end = controller.position.maxScrollExtent;
    await controller.animateTo(end, duration: Duration(milliseconds: (end * 4).round().clamp(4000, 30000)), curve: Curves.linear);
    await Future<void>.delayed(const Duration(seconds: 3));
    await controller.animateTo(0, duration: const Duration(seconds: 5), curve: Curves.linear);
    await Future<void>.delayed(const Duration(seconds: 1));
    report();
  }

  void report() {
    double pct(List<double> v, double p) => v.isEmpty ? 0 : v[(v.length * p).floor().clamp(0, v.length - 1)];
    final build = _timings.map((t) => t.buildDuration.inMicroseconds / 1000).toList()..sort();
    final raster = _timings.map((t) => t.rasterDuration.inMicroseconds / 1000).toList()..sort();
    final total = _timings.map((t) => t.totalSpan.inMicroseconds / 1000).toList()..sort();
    final line = ('BENCH frames=${_timings.length} '
        'build p50=${pct(build, .5).toStringAsFixed(2)} p90=${pct(build, .9).toStringAsFixed(2)} '
        'raster p50=${pct(raster, .5).toStringAsFixed(2)} p90=${pct(raster, .9).toStringAsFixed(2)} '
        'total p90=${pct(total, .9).toStringAsFixed(2)} max=${total.isEmpty ? 0 : total.last.toStringAsFixed(2)} ms '
        'rss=${(ProcessInfo.currentRss / 1048576).round()} MB maxRss=${(ProcessInfo.maxRss / 1048576).round()} MB');
    stdout.writeln(line);
    // A Windows GUI app has no console: the report also goes to a file.
    File('${Directory.systemTemp.path}/oim-library-bench.txt').writeAsStringSync('$line\n');
  }
}
