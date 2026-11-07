/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { afterEach, describe, expect, it, vi } from "vitest";
import {
  formatCompactTitle,
  LibraryLruCache,
  LibraryClient,
  SHOWCASE_API,
} from "./libraryClient.js";

describe("formatCompactTitle", () => {
  it("leaves empty or default title intact", () => {
    expect(formatCompactTitle("")).toBe("");
    expect(formatCompactTitle("OIM Viewer")).toBe("OIM Viewer");
  });

  it("strips .oim.png and .png extensions", () => {
    expect(formatCompactTitle("poster_design.oim.png")).toBe("poster_design");
    expect(formatCompactTitle("dashboard.png")).toBe("dashboard");
  });

  it("truncates names longer than maxChars with an ellipsis", () => {
    const raw = "sistema_de_tokens_dinamicos_temas_dynamic_color_roles_01_ui_dashboard_tema_claro.oim.png";
    const formatted = formatCompactTitle(raw, 18);
    expect(formatted.length).toBeLessThanOrEqual(19); // 18 chars + '…'
    expect(formatted.endsWith("…")).toBe(true);
    expect(formatted.startsWith("sistema_de_tokens_")).toBe(true);
  });

  it("does not truncate names within maxChars", () => {
    expect(formatCompactTitle("Growth Metrics", 18)).toBe("Growth Metrics");
  });
});

describe("LibraryLruCache", () => {
  it("stores and retrieves cached entries", () => {
    const cache = new LibraryLruCache(1000);
    const data1 = new Uint8Array([1, 2, 3, 4]);
    cache.set("url1", data1);

    expect(cache.get("url1")).toBe(data1);
    expect(cache.getTotalBytes()).toBe(4);
    expect(cache.getEntryCount()).toBe(1);
  });

  it("evicts oldest entries when exceeding maxBytes quota", () => {
    // 10 bytes max
    const cache = new LibraryLruCache(10);
    const item1 = new Uint8Array([1, 2, 3, 4]); // 4 bytes
    const item2 = new Uint8Array([5, 6, 7, 8]); // 4 bytes
    const item3 = new Uint8Array([9, 10, 11, 12]); // 4 bytes (total would be 12 > 10)

    cache.set("url1", item1);
    cache.set("url2", item2);
    expect(cache.getTotalBytes()).toBe(8);

    // Adding item3 should evict url1 (the oldest)
    cache.set("url3", item3);
    expect(cache.get("url1")).toBeNull();
    expect(cache.get("url2")).toBe(item2);
    expect(cache.get("url3")).toBe(item3);
    expect(cache.getTotalBytes()).toBe(8);
  });

  it("updates access order on get", () => {
    const cache = new LibraryLruCache(10);
    const item1 = new Uint8Array([1, 2, 3, 4]);
    const item2 = new Uint8Array([5, 6, 7, 8]);
    const item3 = new Uint8Array([9, 10, 11, 12]);

    cache.set("url1", item1);
    cache.set("url2", item2);

    // Access url1 to make it most recently used
    cache.get("url1");

    // Now url2 is the oldest; adding item3 should evict url2 instead of url1
    cache.set("url3", item3);
    expect(cache.get("url2")).toBeNull();
    expect(cache.get("url1")).toBe(item1);
    expect(cache.get("url3")).toBe(item3);
  });

  it("does not store single items larger than maxBytes", () => {
    const cache = new LibraryLruCache(10);
    const oversized = new Uint8Array(20);
    cache.set("oversized", oversized);

    expect(cache.get("oversized")).toBeNull();
    expect(cache.getTotalBytes()).toBe(0);
  });
});

describe("LibraryClient (public showcase API)", () => {
  const item = (id: string) => ({ id, created_at: "2026-11-06T12:00:00Z" });
  afterEach(() => vi.unstubAllGlobals());

  it("reads the first page from the public API without any key", async () => {
    const fetchMock = vi.fn(async () => Response.json({ items: [item("a")], next_cursor: "c1" }));
    vi.stubGlobal("fetch", fetchMock);
    const client = new LibraryClient(new LibraryLruCache());
    expect(await client.fetchShowcaseItems()).toHaveLength(1);
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit | undefined];
    expect(url).toBe(`${SHOWCASE_API}?limit=48`);
    expect(init?.headers).toBeUndefined();
    expect(client.hasMore).toBe(true);
  });

  it("sends category and search to the server and refetches when they change", async () => {
    const fetchMock = vi.fn(async () => Response.json({ items: [item("a")], next_cursor: null }));
    vi.stubGlobal("fetch", fetchMock);
    const client = new LibraryClient(new LibraryLruCache());
    await client.fetchShowcaseItems(false, { category: "ui", q: " hero " });
    await client.fetchShowcaseItems(false, { category: "ui", q: " hero " });
    await client.fetchShowcaseItems(false, {});
    const urls = fetchMock.mock.calls.map((c) => String((c as unknown as [string])[0]));
    expect(urls).toEqual([`${SHOWCASE_API}?limit=48&category=ui&q=hero`, `${SHOWCASE_API}?limit=48`]);
  });

  it("loadMore sends the cursor and appends", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(Response.json({ items: [item("a")], next_cursor: "c1" }))
      .mockResolvedValueOnce(Response.json({ items: [item("b")], next_cursor: null }));
    vi.stubGlobal("fetch", fetchMock);
    const client = new LibraryClient(new LibraryLruCache());
    await client.fetchShowcaseItems();
    const all = await client.fetchMoreShowcaseItems();
    expect(all.map((i) => i.id)).toEqual(["a", "b"]);
    expect(String(fetchMock.mock.calls[1][0])).toContain("cursor=c1");
    expect(client.hasMore).toBe(false);
  });

  it("checkForUpdates reads the count from /updates", async () => {
    const fetchMock = vi.fn(async () => Response.json({ count: 3, latest: "2026-11-06T12:00:00Z" }));
    vi.stubGlobal("fetch", fetchMock);
    const r = await new LibraryClient(new LibraryLruCache()).checkForUpdates();
    expect(r).toEqual({ hasNew: true, latestDate: "2026-11-06T12:00:00Z", count: 3 });
    expect(String((fetchMock.mock.calls[0] as unknown as [string])[0])).toContain("/v1/showcase/updates?since=");
  });
});
