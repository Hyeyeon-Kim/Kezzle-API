import { ImageDto } from './api/image.dto';
import { ImageValue } from './application/image.value';
import { ImageMapper } from './image.mapper';

describe('ImageMapper', () => {
  const persistenceImage = {
    name: 'legacy.png',
    converte_name: 'legacy-converted.png',
    key: 'cakes/legacy-converted.png',
    s3Url: 'https://cdn.example.com/cakes/legacy-converted.png',
  };

  const imageValue: ImageValue = {
    name: 'legacy.png',
    converteName: 'legacy-converted.png',
    key: 'cakes/legacy-converted.png',
    s3Url: 'https://cdn.example.com/cakes/legacy-converted.png',
  };

  it('maps the legacy Mongo field to the application camelCase value', () => {
    expect(ImageMapper.toValue(persistenceImage)).toEqual(imageValue);
  });

  it('maps the application value back to the unchanged Mongo field', () => {
    expect(ImageMapper.toPersistence(imageValue)).toEqual(persistenceImage);
  });

  it('maps the application value to the unchanged API JSON key', () => {
    expect(new ImageDto(imageValue)).toEqual(persistenceImage);
    expect(ImageDto.fromPersistence(persistenceImage)).toEqual(
      persistenceImage,
    );
  });
});
