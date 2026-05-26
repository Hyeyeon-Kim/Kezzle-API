import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Store } from 'src/store/entities/store.schema';
import { StoreSimpleResponseDto } from 'src/store/dto/response-simple-store.dto';
import { CakeSimilarResponseDto } from './dto/response-similar-cake.dto';
import { CakesResponseDto } from './dto/response-cakes.dto';
import { MetricsService } from 'src/metrics/metrics.service';
import { VitClient } from 'src/ai-search/vit-client';

@Injectable()
export class SimilarCakeService {
  constructor(
    @InjectModel(Store.name, 'kezzle')
    private readonly storeModel: Model<Store>,
    private readonly vitClient: VitClient,
    private readonly metricsService: MetricsService,
  ) {}

  async execute(
    cakeid: string,
    lon: number,
    lat: number,
    dist: number,
    size: number,
  ): Promise<CakesResponseDto> {
    const endSimilarSearch =
      this.metricsService.similarSearchDuration.startTimer();

    try {
      const cakes = await this.vitClient.similarSearchWithLocation(
        cakeid,
        lon,
        lat,
        dist,
        size,
      );
      const storeMap = await this.loadStoresByIds(cakes);
      const cakeResponse = this.assembleResponse(cakes, storeMap);

      endSimilarSearch({ status: 'success' });
      return new CakesResponseDto(cakeResponse, false);
    } catch (err) {
      endSimilarSearch({ status: 'error' });
      throw err;
    }
  }

  private async loadStoresByIds(cakes: any[]) {
    const storeIds = [
      ...new Set(cakes.map((cake) => cake.owner_store_id).filter(Boolean)),
    ];

    const endStoreQuery = this.metricsService.storeQueryDuration.startTimer();
    const stores = await this.storeModel
      .find(
        { _id: { $in: storeIds } },
        { name: 1, address: 1, taste: 1, location: 1 },
      )
      .lean();
    endStoreQuery();

    return new Map(stores.map((store) => [store._id.toString(), store]));
  }

  private assembleResponse(cakes: any[], storeMap: Map<string, any>) {
    return cakes
      .map((cake) => {
        const store = storeMap.get(cake.owner_store_id);
        if (!store) {
          return null;
        }
        return new CakeSimilarResponseDto(
          cake,
          new StoreSimpleResponseDto(store),
        );
      })
      .filter((cake) => cake !== null);
  }
}
