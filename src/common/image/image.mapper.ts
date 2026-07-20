import { ImageValue } from './application/image.value';

export interface ImagePersistenceRecord {
  readonly name: string;
  readonly converte_name: string;
  readonly key: string;
  readonly s3Url: string;
}

export class ImageMapper {
  static toValue(image: ImagePersistenceRecord): ImageValue {
    return {
      name: image.name,
      converteName: image.converte_name,
      key: image.key,
      s3Url: image.s3Url,
    };
  }

  static toPersistence(image: ImageValue): ImagePersistenceRecord {
    return {
      name: image.name,
      converte_name: image.converteName,
      key: image.key,
      s3Url: image.s3Url,
    };
  }
}
