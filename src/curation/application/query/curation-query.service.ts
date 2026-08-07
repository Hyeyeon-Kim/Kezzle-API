import { Injectable } from '@nestjs/common';
import { CurationRepository } from 'src/curation/infrastructure/persistence/curation.repository';

@Injectable()
export class CurationQueryService {
  constructor(private readonly curationRepository: CurationRepository) {}

  findFeatured(limit: number, maxTimeMs?: number) {
    return this.curationRepository.findFeatured(limit, maxTimeMs);
  }
}
