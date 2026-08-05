import {
  KeywordRankingView,
  PopularRankingView,
} from '../application/ranking.view';
import { KeywordRankResponseDto } from './dto/keyword-rank-response.dto';
import { PopularCakesResponseDto } from './dto/popular-cakes-response.dto';

export class RankingPresenter {
  static keyword(view: KeywordRankingView): KeywordRankResponseDto {
    return new KeywordRankResponseDto(view);
  }

  static popular(view: PopularRankingView): PopularCakesResponseDto {
    return new PopularCakesResponseDto(view);
  }
}
