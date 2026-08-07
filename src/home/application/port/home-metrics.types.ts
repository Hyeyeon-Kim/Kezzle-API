export type HomeRequestStatus = 'success' | 'error';

export type HomeSectionName =
  | 'recommendCakes'
  | 'anniversary'
  | 'popularCakes'
  | 'keywordRanks'
  | 'newestCakes'
  | 'curations';

export type HomeSectionStatus = 'success' | 'fallback';

export type HomeSectionFallbackReason = 'none' | 'timeout' | 'dependency_error';

export type HomeAiDependency = 'vit' | 'clip';

export type HomeCacheEvent =
  | 'fresh_hit'
  | 'stale_hit'
  | 'miss'
  | 'refresh'
  | 'error';

export type HomeDetailSectionName =
  | 'recommend'
  | 'anniversary'
  | 'popular'
  | 'keywordRanks'
  | 'newestCakes'
  | 'curations';
