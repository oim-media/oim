/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */

export interface ShowcaseAuthor {
  id?: string;
  username?: string;
  avatar_url?: string;
}

export interface ShowcaseItem {
  id: string;
  title: string;
  title_en?: string;
  thumbnail_url: string;
  media_url: string;
  type: "image" | "video";
  aspect_ratio: string;
  features?: string[];
  tags?: string[];
  description?: string;
  description_en?: string;
  category?: string;
  created_at: string;
  author?: ShowcaseAuthor;
}

// Only what the gallery shows: never author or moderation columns.
const PUBLIC_COLUMNS =
  "id,title,title_en,description,description_en,thumbnail_url,media_url,type,aspect_ratio,category,tags,features,created_at";

const SUPABASE_URL = "https://eawltbnmonimtmtqslmk.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVhd2x0Ym5tb25pbXRtdHFzbG1rIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODIyNDEwOTAsImV4cCI6MjA5NzgxNzA5MH0.EERuWIHr-WcXvewklF3DbjIZz7-JYEPsqpeszCd2ySo";

export const MAX_CACHE_BYTES = 50 * 1024 * 1024; // 50 MB strict quota
const LAST_SEEN_KEY = "oim_viewer_library_last_seen";

interface CacheEntry {
  url: string;
  data: Uint8Array;
  size: number;
  lastAccessed: number;
}

/**
 * High-performance LRU Cache for library media assets.
 * Keeps memory bounded under 50 MB, avoiding redundant network transfers
 * while respecting system resources.
 */
export class LibraryLruCache {
  private memoryEntries = new Map<string, CacheEntry>();
  private totalBytes = 0;
  private readonly maxBytes: number;

  constructor(maxBytes = MAX_CACHE_BYTES) {
    this.maxBytes = maxBytes;
  }

  public get(url: string): Uint8Array | null {
    const entry = this.memoryEntries.get(url);
    if (!entry) return null;
    entry.lastAccessed = Date.now();
    this.memoryEntries.delete(url);
    this.memoryEntries.set(url, entry);
    return entry.data;
  }

  public set(url: string, data: Uint8Array): void {
    const existing = this.memoryEntries.get(url);
    if (existing) {
      this.totalBytes -= existing.size;
      this.memoryEntries.delete(url);
    }

    const size = data.byteLength;
    if (size > this.maxBytes) return;

    while (this.totalBytes + size > this.maxBytes && this.memoryEntries.size > 0) {
      const oldestKey = this.memoryEntries.keys().next().value;
      if (!oldestKey) break;
      const oldest = this.memoryEntries.get(oldestKey);
      if (oldest) {
        this.totalBytes -= oldest.size;
        this.memoryEntries.delete(oldestKey);
      }
    }

    const entry: CacheEntry = {
      url,
      data,
      size,
      lastAccessed: Date.now(),
    };
    this.memoryEntries.set(url, entry);
    this.totalBytes += size;
  }

  public clear(): void {
    this.memoryEntries.clear();
    this.totalBytes = 0;
  }

  public getTotalBytes(): number {
    return this.totalBytes;
  }

  public getEntryCount(): number {
    return this.memoryEntries.size;
  }
}

export const globalLibraryCache = new LibraryLruCache();

/**
 * Truncates and formats artwork titles for compact chrome spaces.
 */
export function formatCompactTitle(raw: string, maxChars = 18): string {
  if (!raw || raw.trim().length === 0 || raw === "OIM Viewer") return raw;
  let clean = raw.replace(/\.oim(\.png)?$/i, "").replace(/\.png$/i, "").trim();
  if (clean.length > maxChars) {
    clean = clean.slice(0, maxChars) + "…";
  }
  return clean;
}

export class LibraryClient {
  private cache: LibraryLruCache;
  private cachedShowcaseList: ShowcaseItem[] | null = null;
  private lastFetchTime = 0;

  constructor(cache = globalLibraryCache) {
    this.cache = cache;
  }

  /**
   * Fetches public approved showcase items.
   * Cached for 60 seconds in memory to avoid repeated queries on filter clicks.
   */
  public async fetchShowcaseItems(forceRefresh = false): Promise<ShowcaseItem[]> {
    const now = Date.now();
    if (!forceRefresh && this.cachedShowcaseList && now - this.lastFetchTime < 60000) {
      return this.cachedShowcaseList;
    }

    const url = `${SUPABASE_URL}/rest/v1/showcase_items?status=eq.approved&order=created_at.desc&select=${PUBLIC_COLUMNS}`;
    const response = await fetch(url, {
      method: "GET",
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch public showcase items: ${response.status}`);
    }

    const data = (await response.json()) as ShowcaseItem[];
    this.cachedShowcaseList = data;
    this.lastFetchTime = now;
    return data;
  }

  /**
   * Loads the raw .oim.png bytes into memory without any local file write or export.
   * In desktop Tauri, invokes the native command `read_remote_oim_file` to completely bypass webview CORS restrictions.
   */
  public async fetchOimBytes(mediaUrl: string): Promise<Uint8Array> {
    const cached = this.cache.get(mediaUrl);
    if (cached) {
      return cached;
    }

    // Try Tauri native command first (bypasses browser CORS completely)
    try {
      const { invoke } = await import("@tauri-apps/api/core");
      const rawBytes = await invoke<number[] | Uint8Array>("read_remote_oim_file", { url: mediaUrl });
      const bytes = rawBytes instanceof Uint8Array ? rawBytes : new Uint8Array(rawBytes);
      this.cache.set(mediaUrl, bytes);
      return bytes;
    } catch {
      // Fallback for browser tests or web environment
      const res = await fetch(mediaUrl, { method: "GET" });
      if (!res.ok) {
        throw new Error(`Failed to load artwork from library: ${res.status}`);
      }
      const buffer = await res.arrayBuffer();
      const bytes = new Uint8Array(buffer);
      this.cache.set(mediaUrl, bytes);
      return bytes;
    }
  }

  /**
   * Checks whether new items have been published since the last visit.
   */
  public async checkForUpdates(): Promise<{ hasNew: boolean; latestDate: string | null; count: number }> {
    try {
      const items = await this.fetchShowcaseItems();
      if (!items || items.length === 0) {
        return { hasNew: false, latestDate: null, count: 0 };
      }

      const latestItem = items[0];
      const latestDate = latestItem.created_at;
      const lastSeen = typeof localStorage !== "undefined" ? localStorage.getItem(LAST_SEEN_KEY) : null;

      if (!lastSeen) {
        return { hasNew: true, latestDate, count: items.length };
      }

      const lastSeenTime = new Date(lastSeen).getTime();
      const newItems = items.filter((item) => new Date(item.created_at).getTime() > lastSeenTime);

      return {
        hasNew: newItems.length > 0,
        latestDate,
        count: newItems.length,
      };
    } catch (err) {
      console.warn("[LibraryClient] Check for updates failed:", err);
      return { hasNew: false, latestDate: null, count: 0 };
    }
  }

  /**
   * Marks the current showcase state as viewed by the user.
   */
  public markAsSeen(latestDate?: string): void {
    if (typeof localStorage === "undefined") return;
    const dateToStore = latestDate ?? new Date().toISOString();
    localStorage.setItem(LAST_SEEN_KEY, dateToStore);
  }
}
