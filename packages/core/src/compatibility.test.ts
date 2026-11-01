/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * That the warning fires when it should and STAYS SILENT when it should not.
 *
 * The second matters as much as the first. A warning that fires with the
 * normal files (the ones without `min_player`, that is, all those published
 * until today) becomes background noise, and then nobody reads it the day
 * it says something.
 */

import { describe, it, expect } from "vitest";
import {
  whatTheReaderCannotDo,
  describeMissing,
  CONTRACT_VERSION,
  PLAYER_CAPABILITIES,
  minVersionFor,
  BASE_CONTRACT_VERSION,
} from "./compatibility";

const reader = { version: "1.2.0", capabilities: ["vector_parallax", "infinite_parallax"] };
const inspect = (metadata: any) => whatTheReaderCannotDo(metadata, reader);

describe("when there is nothing to report", () => {
  it("a file without min_player requires nothing", () => {
    expect(inspect({ slots: [] }).hasNotice).toBe(false);
  });

  it("an older version is read without noise", () => {
    expect(inspect({ min_player: "1.0.0" }).hasNotice).toBe(false);
  });

  it("the exact version does not either", () => {
    expect(inspect({ min_player: "1.2.0" }).hasNotice).toBe(false);
  });

  it("a capability that is implemented is not mentioned", () => {
    expect(inspect({ capabilities: ["vector_parallax"] }).hasNotice).toBe(false);
  });

  /**
   * A badly written field is not an incompatibility. If it shouted about this, the
   * warning would lose its meaning before it served any purpose.
   */
  it.each(["", "1.2", "proxima", "v2.0.0", 3, null, {}])(
    "an unreadable min_player (%p) does not invent a warning",
    (v) => {
      expect(inspect({ min_player: v }).hasNotice).toBe(false);
    },
  );

  it("aguanta metadatos rotos", () => {
    expect(inspect(null).hasNotice).toBe(false);
    expect(inspect({ capabilities: "vector_parallax" }).hasNotice).toBe(false);
    expect(inspect({ capabilities: [null, 7, ""] }).hasNotice).toBe(false);
  });
});

describe("when there is something to report", () => {
  it("the file asks for a later version", () => {
    const f = inspect({ min_player: "1.3.0" });
    expect(f.versionTooOld).toBe(true);
    expect(f.requiredVersion).toBe("1.3.0");
  });

  it("compares by number, not by text", () => {
    // "1.10.0" > "1.9.0" numerically, but the other way round alphabetically. It is the
    // classic bug, and the day comes when there are ten minor versions.
    expect(whatTheReaderCannotDo({ min_player: "1.10.0" }, { version: "1.9.0", capabilities: [] }).versionTooOld).toBe(true);
    expect(whatTheReaderCannotDo({ min_player: "1.9.0" }, { version: "1.10.0", capabilities: [] }).versionTooOld).toBe(false);
  });

  it("names the missing capabilities", () => {
    const f = inspect({ capabilities: ["vector_parallax", "physics_2d", "path_morph"] });
    expect(f.missingCapabilities).toEqual(["path_morph", "physics_2d"]);
  });

  it("does not repeat a capability declared twice", () => {
    expect(inspect({ capabilities: ["physics_2d", "physics_2d"] }).missingCapabilities).toEqual(["physics_2d"]);
  });

  /**
   * The two questions are independent: a file can have the right version and still
   * ask for an effect that this reader does not implement.
   */
  it("the right version does not exempt from capabilities", () => {
    const f = inspect({ min_player: "1.0.0", capabilities: ["physics_2d"] });
    expect(f.versionTooOld).toBe(false);
    expect(f.hasNotice).toBe(true);
    expect(f.cannotRender).toBe(false);
  });

  it("satisfied required capabilities neither block rendering nor warn", () => {
    const f = inspect({ capabilities_required: ["vector_parallax"] });
    expect(f.missingRequiredCapabilities).toEqual([]);
    expect(f.cannotRender).toBe(false);
    expect(f.hasNotice).toBe(false);
  });

  it("missing required capabilities set cannotRender and are listed separately", () => {
    const f = inspect({
      capabilities: ["vector_parallax", "path_morph"],
      capabilities_required: ["physics_2d", "path_morph"],
    });
    expect(f.missingCapabilities).toEqual(["path_morph"]);
    expect(f.missingRequiredCapabilities).toEqual(["path_morph", "physics_2d"]);
    expect(f.cannotRender).toBe(true);
    expect(f.hasNotice).toBe(true);
  });

  it("describeMissing warns precisely when required capabilities are missing", () => {
    const f = inspect({ capabilities_required: ["physics_2d"] });
    const text = describeMissing(f);
    expect(text).toContain("It cannot be fully rendered");
    expect(text).toContain("physics_2d");
  });
});

describe("how it is reported", () => {
  it("stays silent when there is nothing", () => {
    expect(describeMissing(inspect({}))).toBe("");
  });

  it("says it rendered what was possible, not that it failed", () => {
    const text = describeMissing(inspect({ min_player: "2.0.0", capabilities: ["physics_2d"] }));
    expect(text).toContain("Rendered what was possible");
    expect(text).toContain("2.0.0");
    expect(text).toContain("physics_2d");
  });
});

describe("what the player declares it implements", () => {
  /**
   * `path_morph` and `physics_2d` are in the schema's enum and NOT in the player's
   * code: zero occurrences, measured. Declaring them would promise what is not
   * done, which is the silence that all of this is meant to break.
   */
  it("does not promise path_morph or physics_2d", () => {
    expect(PLAYER_CAPABILITIES).not.toContain("path_morph");
    expect(PLAYER_CAPABILITIES).not.toContain("physics_2d");
  });

  it("the contract version can be compared", () => {
    expect(CONTRACT_VERSION).toMatch(/^\d+\.\d+\.\d+$/);
  });
});

describe("minVersionFor", () => {
  /**
   * Today nothing requires more than the base, and that is correct: the four
   * capabilities of the schema were born with 1.0.0.
   */
  it("a document from today requires the base version", () => {
    expect(minVersionFor({ slots: [] })).toBe(BASE_CONTRACT_VERSION);
    expect(minVersionFor({ capabilities: ["vector_parallax", "physics_2d"] })).toBe(BASE_CONTRACT_VERSION);
  });

  /**
   * The trap this design avoids: writing the editor's version instead of the one
   * the document needs. A document that uses nothing new must NOT start to require a
   * later version just because whoever wrote it was more modern; it would lock out
   * readers capable of painting it, and the author would not notice because it looks
   * fine in their editor.
   */
  it("does not rise merely because the contract has moved on", () => {
    expect(minVersionFor({ capabilities: ["vector_parallax"] }, { path_morph: "1.4.0" }))
      .toBe(BASE_CONTRACT_VERSION);
  });

  it("rises when the document DOES use something later", () => {
    expect(minVersionFor({ capabilities: ["path_morph"] }, { path_morph: "1.4.0" })).toBe("1.4.0");
  });

  it("with several, keeps the highest", () => {
    const versionMap = { a: "1.2.0", b: "1.10.0", c: "1.3.0" };
    expect(minVersionFor({ capabilities: ["a", "b", "c"] }, versionMap)).toBe("1.10.0");
  });

  it("an unknown capability does not invent a requirement", () => {
    expect(minVersionFor({ capabilities: ["algo_que_no_existe"] }, { path_morph: "1.4.0" }))
      .toBe(BASE_CONTRACT_VERSION);
  });

  it("aguanta metadatos rotos", () => {
    expect(minVersionFor(null)).toBe(BASE_CONTRACT_VERSION);
    expect(minVersionFor({ capabilities: "not a list" })).toBe(BASE_CONTRACT_VERSION);
  });
});

describe("deprecated alias hayAlgoQueDecir", () => {
  it("keeps the value of hasNotice until 2.0.0", () => {
    const f = whatTheReaderCannotDo({ min_player: "9.0.0" }, reader);
    expect(f.hasNotice).toBe(true);
    expect(f.hayAlgoQueDecir).toBe(f.hasNotice);
  });
});
