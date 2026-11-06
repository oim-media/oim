// Copyright (c) 2026 Xue Studios LLC
// SPDX-License-Identifier: Apache-2.0

/// The file name of a Windows or POSIX path.
String fileNameOf(String path) => path.split(RegExp(r'[\\/]')).last;

/// The contract version for the technical sheet. Some files carry `oim: true`
/// as a marker, which must never print as a version.
String schemaVersionOf(Map<String, dynamic> meta) {
  for (final v in [meta['version'], meta['oim']]) {
    if (v is String && v.isNotEmpty) return 'v$v';
  }
  return '—';
}
