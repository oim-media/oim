// Copyright (c) 2026 Xue Studios LLC
// SPDX-License-Identifier: Apache-2.0

// A slot's states and actions, ported from the web player's
// `engines/states.ts`. The shared rule is pinned by
// packages/spec/action-cases.json.

class ResolvedActions {
  final Map<String, bool> visibility;
  final Map<String, String> texts;
  const ResolvedActions(this.visibility, this.texts);
}

/// What a list of actions does to the layers it names, given their current
/// visibility. A layer missing from [current] counts as visible. `play` is
/// not a visibility change and is left to the caller.
ResolvedActions resolveActions(List<dynamic>? actions, Map<String, bool> current) {
  final visibility = <String, bool>{};
  final texts = <String, String>{};
  for (final a in actions ?? const []) {
    if (a is! Map) continue;
    final target = a['target']?.toString() ?? '';
    if (target.isEmpty) continue;
    switch (a['type']) {
      case 'show':
        visibility[target] = true;
      case 'hide':
        visibility[target] = false;
      case 'toggle':
        visibility[target] = !(current[target] ?? true);
      case 'setText':
        texts[target] = a['value']?.toString() ?? '';
    }
  }
  return ResolvedActions(visibility, texts);
}

/// `scale` travels as a percentage (100 = natural size); `<= 10` is an old multiplier.
double scaleAsFactor(num value) => value <= 10 ? value.toDouble() : value / 100;

/// The interaction fields travel in `slot.style` in a real `.oim`, at the root
/// in hand-written ones; both are read, as on the web.
({bool isInteractive, Map? states}) readInteraction(Map slot) {
  final style = slot['style'] is Map ? slot['style'] as Map : const {};
  final interactive = slot['isInteractive'] == true || style['isInteractive'] == true;
  final states = slot['states'] ?? style['states'];
  return (isInteractive: interactive, states: states is Map ? states : null);
}
