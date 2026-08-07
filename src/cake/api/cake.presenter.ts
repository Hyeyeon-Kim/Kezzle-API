import { CakeQueryResult } from '../application/query/cake-query-result';
import { Cake } from '../domain/cake';
import { CakeResponseDto } from './dto/response/cake-response.dto';
import { CakeListResponseDto } from './dto/response/cake-list-response.dto';
import { CakeSimpleResponseDto } from './dto/response/cake-simple-response.dto';
import { CakeSimpleListResponseDto } from './dto/response/cake-simple-list-response.dto';

export class CakePresenter {
  static detail(cake: Cake, viewerId: string): CakeResponseDto {
    return new CakeResponseDto(cake, viewerId);
  }

  static simpleList(page: CakeQueryResult): CakeSimpleListResponseDto {
    return new CakeSimpleListResponseDto(
      page.cakes.map((cake) => new CakeSimpleResponseDto(cake)),
      page.hasMore,
    );
  }

  static recommendations(cakes: Cake[]): CakeSimpleResponseDto[] {
    return cakes.map((cake) => new CakeSimpleResponseDto(cake));
  }

  static anniversary(
    page: CakeQueryResult,
    viewerId: string,
  ): CakeListResponseDto {
    return new CakeListResponseDto(
      page.cakes.map((cake) => new CakeResponseDto(cake, viewerId)),
      page.hasMore,
    );
  }
}
