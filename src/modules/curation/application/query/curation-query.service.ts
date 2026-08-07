import { Injectable } from '@nestjs/common';
import { CurationRepository } from 'src/modules/curation/application/port/curation-repository.port';

@Injectable()
export class CurationQueryService {
  constructor(private readonly curationRepository: CurationRepository) {}

  findFeatured(limit: number, maxTimeMs?: number) {
    return this.curationRepository.findFeatured(limit, maxTimeMs);
  }
}
