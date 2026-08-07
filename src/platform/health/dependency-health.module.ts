import { Module } from '@nestjs/common';
import { DependencyHealthRegistry } from './dependency-health.registry';

@Module({
  providers: [DependencyHealthRegistry],
  exports: [DependencyHealthRegistry],
})
export class DependencyHealthModule {}
