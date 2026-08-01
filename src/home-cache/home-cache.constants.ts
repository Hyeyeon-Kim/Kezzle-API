export const HOME_CACHE_REDIS = Symbol('HOME_CACHE_REDIS');

export const HOME_CACHE_WIRE_VERSION = 'v2';

export function homeCacheKey(suffix: string): string {
  return `home:${HOME_CACHE_WIRE_VERSION}:${suffix}`;
}
