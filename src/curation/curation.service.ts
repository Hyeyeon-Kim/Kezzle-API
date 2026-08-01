import { Injectable } from '@nestjs/common';
import { ClipClient } from 'src/ai-search/clip-client';
import { CakeExternalMapper } from 'src/cake/cake-external.mapper';
import { CurationDetailView, CurationView } from './application/curation.view';
import { CurationExternalMapper } from './curation-external.mapper';
import { CurationRepository } from './curation.repository';

@Injectable()
export class CurationService {
  constructor(
    private readonly curationRepository: CurationRepository,
    private readonly clipClient: ClipClient,
  ) {}

  async createCuration(
    keyword: string,
    description: string,
    note: string,
  ): Promise<CurationView> {
    const cakes = await this.clipClient.koSearch(keyword, 100);

    return this.curationRepository.create({
      cakes: cakes.map((cake) => CurationExternalMapper.toSnapshot(cake)),
      description,
      key: keyword,
      note,
    });
  }

  async updateCuration(curationId: string) {
    const curation = await this.curationRepository.findByIdOrThrow(curationId);

    const cakes = await this.clipClient.koSearch(curation.key, 100);

    // document.save() 는 내용이 같으면 no-op 이라 updatedAt 이 갱신되지 않고
    // stale 판정이 영원히 풀리지 않는다. updateOne 은 내용과 무관하게 updatedAt 을 갱신한다.
    await this.curationRepository.updateCakes(
      curation.id,
      cakes.map((cake) => CurationExternalMapper.toSnapshot(cake)),
    );
  }

  async showCuration(
    curationId: string,
    page: number,
  ): Promise<CurationDetailView> {
    const curation = await this.curationRepository.findByIdOrThrow(curationId);

    if (Number.isNaN(page)) page = 0;
    const { result } = await this.clipClient.koSearchPage(
      curation.key,
      20,
      page,
    );

    return {
      description: curation.description,
      cakes: result.map((cake) => CakeExternalMapper.toView(cake)),
    };
  }
}
