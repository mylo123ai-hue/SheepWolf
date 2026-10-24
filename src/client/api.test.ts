import { afterEach, describe, expect, it, vi } from 'vitest';
import { api } from './api.js';

afterEach(() => vi.unstubAllGlobals());

describe('browser API request headers', () => {
  it('does not mark empty lifecycle controls as JSON bodies', async () => {
    const fetchMock = vi.fn<typeof fetch>(async () => new Response(JSON.stringify({ status: 'paused' })));
    vi.stubGlobal('fetch', fetchMock);

    await api.controlExperiment('run-id', 'pause');

    const init = fetchMock.mock.calls[0]?.[1];
    expect(new Headers(init?.headers).has('content-type')).toBe(false);
  });

  it('keeps JSON content type for requests with a body', async () => {
    const fetchMock = vi.fn<typeof fetch>(async () => new Response(JSON.stringify({ id: 'run-id' })));
    vi.stubGlobal('fetch', fetchMock);

    await api.startExperiment({ scenarioId: 'capture-the-flags', paceMs: 1800, maxDurationMs: 1_200_000, maxDecisions: 100, mode:'demo' });

    const init = fetchMock.mock.calls[0]?.[1];
    expect(new Headers(init?.headers).get('content-type')).toBe('application/json');
  });
});
