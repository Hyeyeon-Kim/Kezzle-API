import { CakePageView } from '../application/cake-result.view';
import { CakeView } from '../application/cake.view';
import { CakeResponseDto } from './dto/response-cake.dto';
import { CakesResponseDto } from './dto/response-cakes.dto';
import { CakeSimpleResponseDto } from './dto/response-cake-simple.dto';
import { CakesSimpleResponseDto } from './dto/response-cakes-simple.dto';

export class CakePresenter {
  static detail(cake: CakeView, viewerId: string): CakeResponseDto {
    return new CakeResponseDto(cake, viewerId);
  }

  static simpleList(page: CakePageView): CakesSimpleResponseDto {
    return new CakesSimpleResponseDto(
      page.cakes.map((cake) => new CakeSimpleResponseDto(cake)),
      page.hasMore,
    );
  }

  static recommendations(cakes: CakeView[]): CakeSimpleResponseDto[] {
    return cakes.map((cake) => new CakeSimpleResponseDto(cake));
  }

  static anniversary(page: CakePageView, viewerId: string): CakesResponseDto {
    return new CakesResponseDto(
      page.cakes.map((cake) => new CakeResponseDto(cake, viewerId)),
      page.hasMore,
    );
  }
}
