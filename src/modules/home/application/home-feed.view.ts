import { AnniversaryRecommendationView } from 'src/modules/anniversary/application/query/anniversary.view';
import { CakeQueryResult } from 'src/modules/cake/application/query/cake-query-result';
import { Cake } from 'src/modules/cake/application/model/cake';
import { CurationView } from 'src/modules/curation/application/curation.view';
import {
  KeywordRankingView,
  PopularRankingView,
} from 'src/modules/ranking/application/query/ranking.view';
import {
  HomeSectionFallbackReason,
  HomeSectionStatus,
} from './home-section.executor';

export interface HomeSectionMetadataView {
  readonly status: HomeSectionStatus;
  readonly reason?: HomeSectionFallbackReason;
  readonly durationMs: number;
}

export interface HomeSectionsView {
  readonly recommendCakes: HomeSectionMetadataView;
  readonly anniversary: HomeSectionMetadataView;
  readonly popularCakes: HomeSectionMetadataView;
  readonly keywordRanks: HomeSectionMetadataView;
  readonly newestCakes: HomeSectionMetadataView;
  readonly curations: HomeSectionMetadataView;
}

export interface HomeFeedView {
  readonly anniversary: AnniversaryRecommendationView;
  readonly recommendCakes: Cake[];
  readonly popularCakes: PopularRankingView;
  readonly keywordRanks: KeywordRankingView;
  readonly newestCakes: CakeQueryResult;
  readonly curations: CurationView[];
  readonly degraded: boolean;
  readonly sections: HomeSectionsView;
}
