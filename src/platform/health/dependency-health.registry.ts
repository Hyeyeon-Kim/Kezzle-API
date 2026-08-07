import { Injectable } from '@nestjs/common';

export type DependencyStatus = 'up' | 'down' | 'disabled';
export type DependencyHealthCheck = () => DependencyStatus;

@Injectable()
export class DependencyHealthRegistry {
  private readonly checks = new Map<string, DependencyHealthCheck>();

  register(name: string, check: DependencyHealthCheck): void {
    this.checks.set(name, check);
  }

  status(name: string): DependencyStatus {
    return this.checks.get(name)?.() ?? 'disabled';
  }
}
