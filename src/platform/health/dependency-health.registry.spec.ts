import { DependencyHealthRegistry } from './dependency-health.registry';

describe('DependencyHealthRegistry', () => {
  it('treats an unregistered optional dependency as disabled', () => {
    expect(new DependencyHealthRegistry().status('redis')).toBe('disabled');
  });

  it('reads the latest status from the registered dependency check', () => {
    const registry = new DependencyHealthRegistry();
    let status: 'up' | 'down' = 'up';
    registry.register('redis', () => status);

    expect(registry.status('redis')).toBe('up');
    status = 'down';
    expect(registry.status('redis')).toBe('down');
  });
});
