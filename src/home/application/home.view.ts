import { AnniversaryRecommendationView } from 'src/anniversary/application/anniversary.view';
import {
  CakePageView,
  PopularCakesView,
} from 'src/cake/application/cake-result.view';
import { CakeView } from 'src/cake/application/cake.view';
import { CurationView } from 'src/curation/application/curation.view';
import { SearchRankView } from 'src/search/application/search.view';
import {
  HomeSectionFallbackReason,
  HomeSectionStatus,
} from '../home-section.executor';

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
  readonly popularCakes: PopularCakesView;
  readonly keywordRanks: SearchRankView;
  readonly newestCakes: CakePageView;
  readonly curations: CurationView[];
  readonly degraded: boolean;
  readonly sections: HomeSectionsView;
}
