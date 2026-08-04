export const aiConfigFixture = Object.freeze({
  vitBaseUrl: 'https://api.kezzlecake.com/vit',
  clipBaseUrl: 'https://api.kezzlecake.com/clip',
  httpTimeoutMs: 5000,
});

export const authConfigFixture = Object.freeze({
  nodeEnv: 'test',
  developmentBypass: false,
  homeResilienceBypass: false,
  homeResilienceUserId: 'home-resilience-user',
  homeResilienceCakeLikeIds: [] as string[],
});

export const homeConfigFixture = Object.freeze({
  hardDeadlineMs: 600,
  sectionTimeoutMs: {
    recommendCakes: 250,
    anniversary: 250,
    popularCakes: 50,
    keywordRanks: 400,
    newestCakes: 100,
    curations: 100,
  },
  jsonMetricsEnabled: false,
  cache: {
    redisUrl: undefined,
    commandTimeoutMs: 80,
    connectTimeoutMs: 1000,
    lockTtlMs: 10000,
    jitterPercent: 10,
    policies: {
      anniversary: { freshTtlMs: 300000, staleTtlMs: 1800000 },
      recommend: { freshTtlMs: 600000, staleTtlMs: 3600000 },
      popular: { freshTtlMs: 60000, staleTtlMs: 600000 },
      keywordRanks: { freshTtlMs: 60000, staleTtlMs: 600000 },
      newest: { freshTtlMs: 60000, staleTtlMs: 600000 },
      curations: { freshTtlMs: 300000, staleTtlMs: 1800000 },
    },
  },
});

export const rankingConfigFixture = Object.freeze({
  keywordWindowDays: 30,
  popularWindowDays: 30,
  keywordTtlMs: 600000,
  popularTtlMs: 600000,
  popularSourceMaxTimeMs: 5000,
});

export const curationConfigFixture = Object.freeze({
  refreshEnabled: true,
  refreshIntervalMs: 600000,
  staleMs: 3 * 24 * 60 * 60 * 1000,
});
