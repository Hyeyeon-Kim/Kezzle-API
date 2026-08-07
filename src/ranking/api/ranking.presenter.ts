import {
  KeywordRankingView,
  PopularRankingView,
} from 'src/ranking/application/query/ranking.view';
import { KeywordRankResponseDto } from 'src/ranking/api/dto/response/keyword-rank-response.dto';
import { PopularCakesResponseDto } from 'src/ranking/api/dto/response/popular-cakes-response.dto';

export class RankingPresenter {
  static keyword(view: KeywordRankingView): KeywordRankResponseDto {
    return new KeywordRankResponseDto(view);
  }

  static popular(view: PopularRankingView): PopularCakesResponseDto {
    return new PopularCakesResponseDto(view);
  }
}
