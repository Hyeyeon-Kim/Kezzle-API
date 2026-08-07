import { ImageValue } from './image.value';

export interface ExternalImageContract {
  readonly name?: string;
  readonly converteName?: string;
  readonly converte_name?: string;
  readonly key?: string;
  readonly s3Url?: string;
}

export class ImageExternalMapper {
  static toValue(image: ExternalImageContract): ImageValue {
    return {
      name: image.name,
      converteName: image.converteName ?? image.converte_name,
      key: image.key,
      s3Url: image.s3Url,
    };
  }
}
