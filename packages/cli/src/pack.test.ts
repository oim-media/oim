/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect, vi, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { packageRemoteSigned } from './pack.js';

const here = dirname(fileURLToPath(import.meta.url));

describe('packageRemoteSigned', () => {
  const originalEnv = process.env.OIM_API_KEY;

  afterEach(() => {
    if (originalEnv === undefined) {
      delete process.env.OIM_API_KEY;
    } else {
      process.env.OIM_API_KEY = originalEnv;
    }
  });

  it('fails fast without calling fetch when no API key is configured', async () => {
    delete process.env.OIM_API_KEY;
    const fetchMock = vi.fn();

    await expect(
      packageRemoteSigned(new Uint8Array([1, 2, 3]), 'base.png', { oim: '2.0.0' }, { fetchImpl: fetchMock as any })
    ).rejects.toThrow(/OIM_API_KEY/);

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('posts multipart FormData to public /v1/oim/package with X-API-Key and returns PNG bytes', async () => {
    const fakeSignedPng = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 1, 2, 3]);
    let capturedUrl = '';
    let capturedInit: RequestInit | undefined;

    const fetchMock = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
      capturedUrl = String(url);
      capturedInit = init;
      return new Response(fakeSignedPng, { status: 200, headers: { 'Content-Type': 'image/png' } });
    });

    const meta = {
      oim: '2.0.0',
      canvas: { width: 800, height: 600 },
      languages: ['en'],
      layers: [],
    };

    const result = await packageRemoteSigned(
      new Uint8Array([0x89, 0x50, 0x4e, 0x47]),
      'base.png',
      meta,
      { apiKey: 'ent_test_key', fetchImpl: fetchMock as any }
    );

    expect(capturedUrl).toBe('https://api.oim.media/v1/oim/package');
    expect(capturedInit?.method).toBe('POST');
    expect((capturedInit?.headers as Record<string, string>)['X-API-Key']).toBe('ent_test_key');

    const body = capturedInit?.body as FormData;
    expect(body).toBeInstanceOf(FormData);
    expect(body.get('metadata')).toBe(JSON.stringify(meta));
    const fileField = body.get('file') as File;
    expect(fileField).toBeTruthy();
    expect(fileField.name).toBe('base.png');
    expect(result).toEqual(fakeSignedPng);
  });

  it('falls back to process.env.OIM_API_KEY when apiKey option is omitted', async () => {
    process.env.OIM_API_KEY = 'env_enterprise_key';
    let authHeader = '';

    const fetchMock = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      authHeader = (init?.headers as Record<string, string>)['X-API-Key'];
      return new Response(new Uint8Array([9, 9]), { status: 200 });
    });

    await packageRemoteSigned(new Uint8Array([1]), 'art.png', { oim: '2.0.0' }, { fetchImpl: fetchMock as any });
    expect(authHeader).toBe('env_enterprise_key');
  });

  it('surfaces HTTP errors from /v1/oim/package', async () => {
    const fetchMock = vi.fn(async () => new Response('{"code":"OIM_E_AUTH_REQUIRED"}', { status: 401 }));

    await expect(
      packageRemoteSigned(new Uint8Array([1]), 'art.png', { oim: '2.0.0' }, { apiKey: 'bad', fetchImpl: fetchMock as any })
    ).rejects.toThrow(/401/);
  });

  it('does not reference the private /v1/media/sign-json endpoint in pack.ts', () => {
    const source = readFileSync(resolve(here, 'pack.ts'), 'utf8');
    expect(source).not.toContain('/v1/media/sign-json');
    expect(source).not.toContain('OIM_BACKEND_API_KEY');
  });
});
