import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { ClipClient } from 'src/ai-search/clip-client';
import { CakeSimpleResponseDto } from 'src/cake/dto/response-cake-simple.dto';
import { CurationCakeResponsDto } from './dto/response-curation-cake.dto';
import { Curation } from './entities/curation.schema';
import { CurationNotFoundException } from './exceptions/curation-not-found.exception';

@Injectable()
export class CurationService {
  constructor(
    @InjectModel(Curation.name, 'kezzle')
    private readonly curationModel: Model<Curation>,
    private readonly clipClient: ClipClient,
  ) {}

  async createCuration(keyword: string, disc: string, note: string) {
    const cakes = await this.clipClient.koSearch(keyword, 100);

    return this.curationModel.create({
      cakes,
      description: disc,
      key: keyword,
      note,
    });
  }

  async updateCuration(curationId: string) {
    const curation = await this.curationModel.findById(curationId).catch(() => {
      throw new CurationNotFoundException(curationId);
    });
    if (!curation) {
      throw new CurationNotFoundException(curationId);
    }

    const cakes = await this.clipClient.koSearch(curation.key, 100);

    // document.save() 는 내용이 같으면 no-op 이라 updatedAt 이 갱신되지 않고
    // stale 판정이 영원히 풀리지 않는다. updateOne 은 내용과 무관하게 updatedAt 을 갱신한다.
    await this.curationModel.updateOne(
      { _id: curation._id },
      { $set: { cakes } },
    );
  }

  async showCuration(curationId: string, page: number) {
    const curation = await this.curationModel.findById(curationId).catch(() => {
      throw new CurationNotFoundException(curationId);
    });
    if (!curation) {
      throw new CurationNotFoundException(curationId);
    }

    if (Number.isNaN(page)) page = 0;
    const { result } = await this.clipClient.koSearchPage(
      curation.key,
      20,
      page,
    );

    const response = result.map((cake) => new CakeSimpleResponseDto(cake));
    return new CurationCakeResponsDto(curation.description, response);
  }
}
