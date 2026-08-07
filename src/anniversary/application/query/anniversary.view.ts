export interface AnniversaryView {
  readonly id: string;
  readonly name: string;
  readonly keyword: string[];
  readonly date: Date;
  readonly mention: string;
}

export interface AnniversaryRecommendationView {
  readonly id: string;
  readonly name: string;
  readonly dday: string;
  readonly mention: string;
  readonly images: string[];
}
