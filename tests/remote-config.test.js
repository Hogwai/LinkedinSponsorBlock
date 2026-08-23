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

// Deep-ish merge helper to build mutated copies of a valid profile so each
// validation branch can be exercised independently. Keys explicitly set to
// `undefined` are removed (so e.g. `{ feedWrapper: undefined }` deletes it).
function omitUndefined(obj) {
    for (const k of Object.keys(obj)) {
        if (obj[k] === undefined) delete obj[k];
    }
    return obj;
}

function makeProfile(overrides = {}) {
    const detOverrides = overrides.detection || {};
    const baseDet = validProfile.detection;
    return omitUndefined({
        ...validProfile,
        ...omitUndefined({ ...overrides }),
        feedWrapper: omitUndefined({
            ...validProfile.feedWrapper,
            ...(omitUndefined({ ...(overrides.feedWrapper || {}) })),
        }),
        postContainers:
            overrides.postContainers === undefined
                ? [...validProfile.postContainers]
                : overrides.postContainers,
        detection: omitUndefined({
            sponsored: omitUndefined({
                ...baseDet.sponsored,
                ...omitUndefined({ ...(detOverrides.sponsored || {}) }),
            }),
            suggested: omitUndefined({
                ...baseDet.suggested,
                ...omitUndefined({ ...(detOverrides.suggested || {}) }),
            }),
            recommended: omitUndefined({
                ...baseDet.recommended,
                ...omitUndefined({ ...(detOverrides.recommended || {}) }),
            }),
        }),
    });
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
            CONFIG.profiles.desktop.detection.sponsored.keywords.has('promoted'),
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

    it('logs warning when cached config has profile with null detection', async () => {
        const configWithNullDetection = {
            version: 2,
            profiles: {
                desktop: {
                    feedWrapper: { mobile: null, desktop: null, newFeed: null },
                    postContainers: ['.feed-shared-update-v2'],
                    detection: null,
                },
            },
        };
        const storage = makeStorage(configWithNullDetection);
        const fetcher = vi.fn().mockResolvedValue(validConfig);

        await remoteConfig.applyRemoteConfig(storage, fetcher);

        expect(logger.warn).toHaveBeenCalledWith(
            'Cached remote config is invalid; using embedded config',
        );
    });

    it('logs warning when cached config has non-object profiles', async () => {
        const configWithBadProfiles = {
            version: 2,
            profiles: 'not-an-object',
        };
        const storage = makeStorage(configWithBadProfiles);
        const fetcher = vi.fn().mockResolvedValue(validConfig);

        await remoteConfig.applyRemoteConfig(storage, fetcher);

        expect(logger.warn).toHaveBeenCalledWith(
            'Cached remote config is invalid; using embedded config',
        );
    });
});

// ---------------------------------------------------------------------------
// isValidProfile validation fallbacks (cached config rejected per-field)
// ---------------------------------------------------------------------------

describe('isValidProfile validation fallbacks', () => {
    // Each case mutates a valid profile so exactly one validation guard fails.
    // All should be rejected with the same "invalid cache" warning.
    it.each([
        ['profile is null', null],
        ['feedWrapper is missing', { feedWrapper: undefined }],
        ['feedWrapper value is a non-string non-null', makeProfile({ feedWrapper: { mobile: 123 } })],
        ['feedWrapper value is an empty string', makeProfile({ feedWrapper: { desktop: '' } })],
        ['feedWrapper value is an invalid CSS selector', makeProfile({ feedWrapper: { newFeed: '[[' } })],
        ['postContainers is missing', { postContainers: undefined }],
        ['postContainers is empty', makeProfile({ postContainers: [] })],
        ['postContainers contains a non-string', makeProfile({ postContainers: [123] })],
        ['detection entry is missing', (() => {
            const p = makeProfile();
            delete p.detection.sponsored;
            return p;
        })()],
        ['keywordSelectors is empty', makeProfile({ detection: { sponsored: { keywordSelectors: [] } } })],
        ['keywordSelectors has an invalid selector', makeProfile({ detection: { sponsored: { keywordSelectors: ['['] } } })],
        ['keywords is empty', makeProfile({ detection: { sponsored: { keywords: [] } } })],
        ['childSelectors is not an array', makeProfile({ detection: { suggested: { childSelectors: 'x' } } })],
        ['childSelectors has an invalid selector', makeProfile({ detection: { recommended: { childSelectors: ['['] } } })],
    ])('rejects cached config when %s', async (_label, profile) => {
        const storage = makeStorage({
            version: 2,
            profiles: { desktop: profile },
        });

        await remoteConfig.applyRemoteConfig(storage, vi.fn());

        expect(logger.warn).toHaveBeenCalledWith(
            'Cached remote config is invalid; using embedded config',
        );
        expect(logger.info).not.toHaveBeenCalledWith(
            'Remote config fetched and applied',
        );
    });
});

// ---------------------------------------------------------------------------
// __NO_REMOTE_CONFIG__ build flag
// ---------------------------------------------------------------------------

describe('__NO_REMOTE_CONFIG__ disabled mode', () => {
    // resetModules() gives the fresh module its own logger/config instances,
    // so re-import them and re-attach spies before asserting.
    async function importWithFlag(flagValue) {
        globalThis.__NO_REMOTE_CONFIG__ = flagValue;
        vi.resetModules();
        const [mod, configMod, loggerMod] = await Promise.all([
            import('../src/shared/remote-config.js'),
            import('../src/shared/config.js'),
            import('../src/shared/logger.js'),
        ]);
        vi.spyOn(loggerMod.logger, 'info').mockReturnValue(undefined);
        vi.spyOn(loggerMod.logger, 'warn').mockReturnValue(undefined);
        return { remoteConfig: mod, CONFIG: configMod.CONFIG, logger: loggerMod.logger };
    }

    afterEach(() => {
        delete globalThis.__NO_REMOTE_CONFIG__;
    });

    it('short-circuits applyRemoteOverrides and applyRemoteConfig when flag is true', async () => {
        const { remoteConfig: fresh, CONFIG: freshConfig, logger: freshLogger } =
            await importWithFlag(true);

        const fetcher = vi.fn();
        const storage = makeStorage(validConfig);

        // Capture the embedded profile reference; mergeProfile would replace it.
        const modernBefore = freshConfig.profiles.modern;

        fresh.applyRemoteOverrides('desktop');
        await fresh.applyRemoteConfig(storage, fetcher);
        // Allow any (unexpected) fire-and-forget work to surface.
        await new Promise((r) => setTimeout(r, 50));

        expect(fetcher).not.toHaveBeenCalled();
        expect(storage.set).not.toHaveBeenCalled();
        expect(freshLogger.info).not.toHaveBeenCalled();
        expect(freshLogger.warn).not.toHaveBeenCalled();
        // Embedded CONFIG must remain untouched (no merge happened).
        expect(freshConfig.profiles.modern).toBe(modernBefore);
    });

    it('behaves normally when flag is explicitly false', async () => {
        const { remoteConfig: fresh, logger: freshLogger } =
            await importWithFlag(false);

        const fetcher = vi.fn().mockResolvedValue(validConfig);
        const storage = makeStorage(null);

        await fresh.applyRemoteConfig(storage, fetcher);

        await vi.waitFor(() => {
            expect(storage.set).toHaveBeenCalled();
        });
        expect(freshLogger.info).toHaveBeenCalledWith(
            'Remote config fetched and applied',
        );
    });
});

// ---------------------------------------------------------------------------
// Fetch-phase merge and failure edge cases
// ---------------------------------------------------------------------------

describe('fetch phase merge and failures', () => {
    it('merges fetched config when activeProfileName matches (no warning)', async () => {
        remoteConfig.applyRemoteOverrides('desktop');
        const storage = makeStorage(null);
        const fetcher = vi.fn().mockResolvedValue(validConfig);

        await remoteConfig.applyRemoteConfig(storage, fetcher);

        await vi.waitFor(() => {
            expect(storage.set).toHaveBeenCalled();
        });

        expect(logger.warn).not.toHaveBeenCalledWith(
            'Remote config has no profile named: desktop',
        );
        expect(
            CONFIG.profiles.desktop.detection.sponsored.keywords,
        ).toBeInstanceOf(Set);
    });

    it('logs fetch-failed warning when storage.set rejects after a valid fetch', async () => {
        const storage = {
            get: async () => null,
            set: vi.fn().mockRejectedValue(new Error('Quota exceeded')),
        };
        const fetcher = vi.fn().mockResolvedValue(validConfig);

        await remoteConfig.applyRemoteConfig(storage, fetcher);

        await vi.waitFor(() => {
            expect(logger.warn).toHaveBeenCalledWith(
                'Remote config fetch failed; using embedded config',
                expect.any(Error),
            );
        });
    });
});

// ---------------------------------------------------------------------------
// fetchRemoteConfigJSON error propagation
// ---------------------------------------------------------------------------

describe('fetchRemoteConfigJSON error paths', () => {
    it('rejects when response.json() fails to parse invalid JSON', async () => {
        globalThis.fetch = vi.fn().mockResolvedValue({
            ok: true,
            json: async () => {
                throw new SyntaxError('Unexpected token < in JSON');
            },
        });

        await expect(remoteConfig.fetchRemoteConfigJSON()).rejects.toThrow(
            SyntaxError,
        );
    });

    it('rejects when the network request itself fails', async () => {
        globalThis.fetch = vi
            .fn()
            .mockRejectedValue(new TypeError('Failed to fetch'));

        await expect(remoteConfig.fetchRemoteConfigJSON()).rejects.toThrow(
            'Failed to fetch',
        );
    });
});
