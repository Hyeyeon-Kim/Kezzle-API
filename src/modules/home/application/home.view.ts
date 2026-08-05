import { AnniversaryRecommendationView } from 'src/modules/anniversary/application/anniversary.view';
import { CakePageView } from 'src/modules/cake/application/cake-result.view';
import { CakeView } from 'src/modules/cake/application/cake.view';
import { CurationView } from 'src/modules/curation/application/curation.view';
import {
  KeywordRankingView,
  PopularRankingView,
} from 'src/modules/ranking/application/ranking.view';
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

export interface HomeView {
  readonly anniversary: AnniversaryRecommendationView;
  readonly recommendCakes: CakeView[];
  readonly popularCakes: PopularRankingView;
  readonly keywordRanks: KeywordRankingView;
  readonly newestCakes: CakePageView;
  readonly curations: CurationView[];
  readonly degraded: boolean;
  readonly sections: HomeSectionsView;
}
