import {
  LatestSearchView,
  SearchResultView,
} from 'src/search/application/search.view';
import { LatestResponseDto } from './dto/response/latest-search-response.dto';
import {
  SearchCakeResponseDto,
  SearchResponseDto,
} from './dto/response/search-response.dto';

export class SearchPresenter {
  static result(result: SearchResultView, viewerId: string): SearchResponseDto {
    return new SearchResponseDto(
      result.cakes.map((cake) => new SearchCakeResponseDto(cake, viewerId)),
      result.hasMore,
      result.nextPage,
    );
  }

  static latest(result: LatestSearchView): LatestResponseDto {
    return new LatestResponseDto(result.keywords);
  }
}
