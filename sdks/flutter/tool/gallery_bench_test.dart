// Spike (throwaway): fetch the public gallery like the Tauri viewer and time
// download, extract and verify per file.
import 'dart:convert';
import 'dart:io';
import 'dart:typed_data';
import 'package:flutter_test/flutter_test.dart';
import 'package:oim_flutter/oim_flutter.dart';

const base = 'https://eawltbnmonimtmtqslmk.supabase.co';
const anon = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVhd2x0Ym5tb25pbXRtdHFzbG1rIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODIyNDEwOTAsImV4cCI6MjA5NzgxNzA5MH0.EERuWIHr-WcXvewklF3DbjIZz7-JYEPsqpeszCd2ySo';

Future<Uint8List> get(HttpClient c, String url, {bool auth = false}) async {
  final r = await c.getUrl(Uri.parse(url));
  if (auth) {
    r.headers.set('apikey', anon);
    r.headers.set('Authorization', 'Bearer $anon');
  }
  final res = await r.close();
  if (res.statusCode != 200) throw 'HTTP ${res.statusCode} $url';
  final b = BytesBuilder();
  await for (final chunk in res) b.add(chunk);
  return b.takeBytes();
}

void main() => test('gallery bench', _run, timeout: const Timeout(Duration(minutes: 5)));

Future<void> _run() async {
  final c = HttpClient();
  final sw = Stopwatch()..start();
  final list = jsonDecode(utf8.decode(await get(c,
      '$base/rest/v1/showcase_items?status=eq.approved&order=created_at.desc&select=id,title,media_url,type',
      auth: true))) as List;
  print('list: ${list.length} items in ${sw.elapsedMilliseconds} ms');
  var totalBytes = 0, dl = 0, ex = 0, ve = 0, ok = 0;
  for (final it in list) {
    if (it['type'] != 'oim' && !(it['media_url'] as String).contains('.oim')) continue;
    try {
      final t0 = sw.elapsedMicroseconds;
      final bytes = await get(c, it['media_url']);
      final t1 = sw.elapsedMicroseconds;
      final res = extractOIM(bytes);
      final t2 = sw.elapsedMicroseconds;
      final st = verifyOim(res);
      final t3 = sw.elapsedMicroseconds;
      totalBytes += bytes.length; dl += t1 - t0; ex += t2 - t1; ve += t3 - t2; ok++;
      print('${(bytes.length / 1024).round().toString().padLeft(6)} KB  dl ${((t1 - t0) / 1000).round()} ms  extract ${((t2 - t1) / 1000).toStringAsFixed(1)} ms  verify ${((t3 - t2) / 1000).toStringAsFixed(1)} ms  $st  ${it['title']}');
    } catch (e) {
      print('FAIL ${it['title']}: $e');
    }
  }
  print('ok $ok, ${(totalBytes / 1048576).toStringAsFixed(1)} MB; avg dl ${(dl / ok / 1000).round()} ms, extract ${(ex / ok / 1000).toStringAsFixed(1)} ms, verify ${(ve / ok / 1000).toStringAsFixed(1)} ms');
  c.close();
}
