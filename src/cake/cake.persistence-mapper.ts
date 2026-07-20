import { ImageMapper } from 'src/common/image/image.mapper';
import { CreateCakeData, UpdateCakeData } from './application/cake.command';
import { CakeView } from './application/cake.view';

export class CakePersistenceMapper {
  static toView(source: any): CakeView {
    return {
      id: source?._id?.toString() ?? source?.id?.toString(),
      image: source?.image ? ImageMapper.toValue(source.image) : source?.image,
      cursor: source?.cursor,
      likedUserIds: [...(source?.user_like_ids ?? [])],
      ownerStoreId: source?.owner_store_id,
      likeText: source?.like_ins,
      tags: [...(source?.tag_ins ?? [])],
      content: source?.content_ins,
      calculatedLikes: source?.cal_likes,
      faissId: source?.faiss_id,
      isDeleted: source?.is_delete ?? false,
      createdAt: source?.createdAt,
      updatedAt: source?.updatedAt,
    };
  }

  static toCreatePersistence(data: CreateCakeData) {
    return {
      image: ImageMapper.toPersistence(data.image),
      owner_store_id: data.ownerStoreId,
      cursor: data.cursor,
      like_ins: data.likeText,
      tag_ins: data.tags,
      content_ins: data.content,
      faiss_id: data.faissId,
    };
  }

  static toUpdatePersistence(data: UpdateCakeData) {
    return {
      ...(data.image === undefined
        ? {}
        : { image: ImageMapper.toPersistence(data.image) }),
      ...(data.isDeleted === undefined ? {} : { is_delete: data.isDeleted }),
    };
  }
}
