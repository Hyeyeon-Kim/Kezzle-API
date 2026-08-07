import {
  CurationDetailView,
  CurationView,
} from 'src/modules/curation/application/curation.view';
import {
  CurationCakeDto,
  CurationCakeResponseDto,
} from './dto/response/curation-cake-response.dto';

export class CurationPresenter {
  static created(view: CurationView) {
    return {
      _id: view.id,
      cakes: view.cakes.map((cake) => ({
        ...cake.extra,
        id: cake.id,
        image: cake.image
          ? {
              name: cake.image.name,
              converte_name: cake.image.converteName,
              key: cake.image.key,
              s3Url: cake.image.s3Url,
            }
          : undefined,
        owner_store_id: cake.ownerStoreId,
        cursor: cake.cursor,
        tag_ins: [...cake.tags],
        user_like_ids: [...cake.likedUserIds],
        score: cake.score,
      })),
      key: view.key,
      description: view.description,
      note: view.note,
      createdAt: view.createdAt,
      updatedAt: view.updatedAt,
      __v: view.version,
    };
  }

  static detail(view: CurationDetailView): CurationCakeResponseDto {
    return new CurationCakeResponseDto(
      view.description,
      view.cakes.map((cake) => new CurationCakeDto(cake)),
    );
  }
}
