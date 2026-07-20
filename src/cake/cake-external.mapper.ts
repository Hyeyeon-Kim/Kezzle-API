import { ImageValue } from 'src/common/image/application/image.value';
import { ImageMapper } from 'src/common/image/image.mapper';
import { CakeView } from './application/cake.view';

export class CakeExternalMapper {
  static toView(source: any): CakeView {
    return {
      id: source?.id?.toString() ?? source?._id?.toString(),
      image: this.toImageValue(source?.image),
      cursor: source?.cursor,
      likedUserIds: [...(source?.likedUserIds ?? source?.user_like_ids ?? [])],
      ownerStoreId: source?.ownerStoreId ?? source?.owner_store_id,
      likeText: source?.likeText ?? source?.like_ins,
      tags: [...(source?.tags ?? source?.tag_ins ?? [])],
      content: source?.content ?? source?.content_ins,
      calculatedLikes:
        source?.calculatedLikes ?? source?.cal_likes ?? source?.total,
      faissId: source?.faissId ?? source?.faiss_id,
      isDeleted: source?.isDeleted ?? source?.is_delete ?? false,
      createdAt: source?.createdAt,
      updatedAt: source?.updatedAt,
    };
  }

  private static toImageValue(image: any): ImageValue {
    if (image == null || 'converteName' in image) {
      return image;
    }
    return ImageMapper.toValue(image);
  }
}
