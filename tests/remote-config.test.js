import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

let remoteConfig;
let CONFIG;
let logger;

beforeEach(async () => {
    vi.resetModules();
    // Import fresh module instances so module-level state (storedRemoteConfig, etc.)
    // is clean for each test.
    const [mod, configMod, loggerMod] = await Promise.all([
        import('../src/shared/remote-config.js'),
        import('../src/shared/config.js'),
        import('../src/shared/logger.js'),
    ]);
    remoteConfig = mod;
    CONFIG = configMod.CONFIG;
    logger = loggerMod.logger;

    // Spy on logger methods so we can verify calls across module boundaries.
    // These spies replace the methods on the shared logger object that
    // remote-config.js references too.
    vi.spyOn(logger, 'info').mockReturnValue(undefined);
    vi.spyOn(logger, 'warn').mockReturnValue(undefined);
});

afterEach(() => {
    // Ensure all pending microtasks are flushed before coverage collection
    return new Promise((r) => setTimeout(r, 50));
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const validProfile = {
    feedWrapper: { mobile: null, desktop: '.feed-shared-update-v2', newFeed: null },
    postContainers: ['.feed-shared-update-v2'],
    detection: {
        sponsored: {
            keywordSelectors: ['.update-components-actor__description'],
            keywords: ['Promoted', 'Post sponsorisé'],
            childSelectors: [],
        },
        suggested: {
            keywordSelectors: ['.update-components-actor__description'],
            keywords: ['Followed by', 'Suivi par'],
            childSelectors: [],
        },
        recommended: {
            keywordSelectors: ['.update-components-actor__description'],
            keywords: ['Recommended for you', 'Recommandé pour vous'],
            childSelectors: [],
        },
    },
};

const validConfig = {
    version: 2,
    profiles: { desktop: validProfile },
};

function makeStorage(getResult) {
    return {
        get: async () => getResult,
        set: vi.fn().mockResolvedValue(undefined),
    };
}

// ---------------------------------------------------------------------------
// applyRemoteOverrides
// ---------------------------------------------------------------------------

describe('applyRemoteOverrides', () => {
    it('sets activeProfileName even when no stored config', () => {
        remoteConfig.applyRemoteOverrides('desktop');
        expect(logger.info).not.toHaveBeenCalled();
        expect(logger.warn).not.toHaveBeenCalled();
    });

    it('merges stored remote config when profile exists', async () => {
        // Populate storedRemoteConfig by applying a cached config
        await remoteConfig.applyRemoteConfig(makeStorage(validConfig), vi.fn());

        remoteConfig.applyRemoteOverrides('desktop');

        expect(logger.info).toHaveBeenCalledWith(
            'Remote config applied for profile: desktop',
        );
        // Verify merge: keywords converted to Set
        expect(
            CONFIG.profiles.desktop.detection.sponsored.keywords,
        ).toBeInstanceOf(Set);
        expect(
            CONFIG.profiles.desktop.detection.sponsored.keywords.has('Promoted'),
        ).toBe(true);
    });

    it('logs warning when profile does not exist in stored config', async () => {
        await remoteConfig.applyRemoteConfig(makeStorage(validConfig), vi.fn());

        remoteConfig.applyRemoteOverrides('nonexistent');

        expect(logger.warn).toHaveBeenCalledWith(
            'Remote config has no profile named: nonexistent',
        );
    });
});

// ---------------------------------------------------------------------------
// fetchRemoteConfigJSON
// ---------------------------------------------------------------------------

describe('fetchRemoteConfigJSON', () => {
    it('returns parsed JSON on successful fetch', async () => {
        const mockData = { key: 'value' };
        globalThis.fetch = vi.fn().mockResolvedValue({
            ok: true,
            json: async () => mockData,
        });

        const result = await remoteConfig.fetchRemoteConfigJSON();

        expect(result).toEqual(mockData);
        expect(globalThis.fetch).toHaveBeenCalledWith(
            'https://raw.githubusercontent.com/Hogwai/LinkedinSponsorBlock/main/remote-config.json',
            expect.objectContaining({ signal: expect.any(AbortSignal) }),
        );
    });

    it('returns null on HTTP error response', async () => {
        globalThis.fetch = vi.fn().mockResolvedValue({
            ok: false,
            status: 404,
        });

        const result = await remoteConfig.fetchRemoteConfigJSON();

        expect(result).toBeNull();
        expect(logger.warn).toHaveBeenCalledWith(
            'Remote config request failed with status 404',
        );
    });
});

// ---------------------------------------------------------------------------
// applyRemoteConfig
// ---------------------------------------------------------------------------

describe('applyRemoteConfig', () => {
    it('loads valid cached config into memory', async () => {
        const fetcher = vi.fn().mockResolvedValue(validConfig);
        await remoteConfig.applyRemoteConfig(makeStorage(validConfig), fetcher);

        // Phase 2 (fetch) is fire-and-forget; wait for it
        await vi.waitFor(() => {
            expect(fetcher).toHaveBeenCalled();
        });

        expect(logger.warn).not.toHaveBeenCalled();
    });

    it('merges cached config if activeProfileName is already set', async () => {
        // Set activeProfileName first (no stored config yet)
        remoteConfig.applyRemoteOverrides('desktop');

        // Now apply: cache merge should happen because activeProfileName is set
        await remoteConfig.applyRemoteConfig(makeStorage(validConfig), vi.fn());

        await vi.waitFor(() => {
            expect(CONFIG.profiles.desktop).toBeDefined();
        });

        expect(
            CONFIG.profiles.desktop.detection.sponsored.keywords,
        ).toBeInstanceOf(Set);
    });

    it('logs warning when cache is present but invalid', async () => {
        const invalidConfig = { version: 2, profiles: {} }; // empty → invalid
        await remoteConfig.applyRemoteConfig(makeStorage(invalidConfig), vi.fn());

        expect(logger.warn).toHaveBeenCalledWith(
            'Cached remote config is invalid; using embedded config',
        );
    });

    it('handles cached config with invalid CSS selectors gracefully', async () => {
        const configWithInvalidSelector = {
            version: 2,
            profiles: {
                desktop: {
                    feedWrapper: { mobile: null, desktop: null, newFeed: null },
                    postContainers: ['['], // invalid CSS → querySelector throws → catch L35
                    detection: {
                        sponsored: {
                            keywordSelectors: ['.feed-shared-update-v2'],
                            keywords: ['Promoted'],
                            childSelectors: [],
                        },
                        suggested: {
                            keywordSelectors: ['.feed-shared-update-v2'],
                            keywords: ['Followed by'],
                            childSelectors: [],
                        },
                        recommended: {
                            keywordSelectors: ['.feed-shared-update-v2'],
                            keywords: ['Recommended'],
                            childSelectors: [],
                        },
                    },
                },
            },
        };
        const storage = makeStorage(configWithInvalidSelector);
        const fetcher = vi.fn().mockResolvedValue(validConfig);
        await remoteConfig.applyRemoteConfig(storage, fetcher);

        expect(logger.warn).toHaveBeenCalledWith(
            'Cached remote config is invalid; using embedded config',
        );
    });

    it('logs warning when cached config lacks the active profile', async () => {
        remoteConfig.applyRemoteOverrides('mobile');
        const configWithoutMobile = {
            version: 2,
            profiles: { desktop: validProfile },
        };
        const storage = makeStorage(configWithoutMobile);

        await remoteConfig.applyRemoteConfig(storage, vi.fn());

        expect(logger.warn).toHaveBeenCalledWith(
            'Cached remote config has no profile named: mobile',
        );
    });

    it('logs warning when cache read fails', async () => {
        const storage = {
            get: async () => { throw new Error('Storage error'); },
            set: vi.fn(),
        };
        await remoteConfig.applyRemoteConfig(storage, vi.fn());

        expect(logger.warn).toHaveBeenCalledWith(
            'Remote config cache read failed; using embedded config',
            expect.any(Error),
        );
    });

    it('applies valid fetched config and stores it', async () => {
        const storage = makeStorage(null);
        const fetcher = vi.fn().mockResolvedValue(validConfig);

        await remoteConfig.applyRemoteConfig(storage, fetcher);

        await vi.waitFor(() => {
            expect(storage.set).toHaveBeenCalled();
        });

        expect(storage.set).toHaveBeenCalledWith('lsb_remote_config', validConfig);
        expect(logger.info).toHaveBeenCalledWith('Remote config fetched and applied');
    });

    it('stores fetched config even without activeProfileName', async () => {
        const storage = makeStorage(null);
        const fetcher = vi.fn().mockResolvedValue(validConfig);

        await remoteConfig.applyRemoteConfig(storage, fetcher);

        await vi.waitFor(() => {
            expect(storage.set).toHaveBeenCalled();
        });

        expect(logger.info).toHaveBeenCalledWith('Remote config fetched and applied');
    });

    it('logs warning when fetched config lacks the active profile', async () => {
        remoteConfig.applyRemoteOverrides('mobile');
        const storage = makeStorage(null);
        const configWithoutMobile = {
            version: 2,
            profiles: { desktop: validProfile },
        };
        const fetcher = vi.fn().mockResolvedValue(configWithoutMobile);

        await remoteConfig.applyRemoteConfig(storage, fetcher);
        // Phase 2 (fetchRemoteConfig) is fire-and-forget: flush all pending work
        await new Promise((r) => setTimeout(r, 100));

        expect(logger.warn).toHaveBeenCalledWith(
            'Remote config has no profile named: mobile',
        );
    });

    it('logs warning when fetcher returns null', async () => {
        const storage = makeStorage(null);
        const fetcher = vi.fn().mockResolvedValue(null);

        await remoteConfig.applyRemoteConfig(storage, fetcher);

        await vi.waitFor(() => {
            expect(logger.warn).toHaveBeenCalledWith(
                'Remote config fetch returned no config',
            );
        });
    });

    it('logs warning when fetcher returns invalid config', async () => {
        const invalidConfig = { version: 2, profiles: {} };
        const storage = makeStorage(null);
        const fetcher = vi.fn().mockResolvedValue(invalidConfig);

        await remoteConfig.applyRemoteConfig(storage, fetcher);

        await vi.waitFor(() => {
            expect(logger.warn).toHaveBeenCalledWith(
                'Remote config fetch returned invalid config',
            );
        });
    });

    it('logs warning when fetcher throws', async () => {
        const storage = makeStorage(null);
        const fetcher = vi.fn().mockRejectedValue(new Error('Network failure'));

        await remoteConfig.applyRemoteConfig(storage, fetcher);

        await vi.waitFor(() => {
            expect(logger.warn).toHaveBeenCalledWith(
                'Remote config fetch failed; using embedded config',
                expect.any(Error),
            );
        });
    });
});
