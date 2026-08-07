import {
  LatestSearchView,
  SearchResultView,
} from 'src/modules/search/application/search.view';
import { LatestSearchResponseDto } from './dto/response/latest-search-response.dto';
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

  static latest(result: LatestSearchView): LatestSearchResponseDto {
    return new LatestSearchResponseDto(result.keywords);
  }
}
