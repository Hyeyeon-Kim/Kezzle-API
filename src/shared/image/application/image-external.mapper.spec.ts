import { ImageExternalMapper } from './image-external.mapper';

describe('ImageExternalMapper', () => {
  it('maps the legacy external snake-case contract to ImageValue', () => {
    expect(
      ImageExternalMapper.toValue({
        name: 'legacy.png',
        converte_name: 'legacy-converted.png',
        key: 'cakes/legacy-converted.png',
        s3Url: 'https://cdn.example.com/cakes/legacy-converted.png',
      }),
    ).toEqual({
      name: 'legacy.png',
      converteName: 'legacy-converted.png',
      key: 'cakes/legacy-converted.png',
      s3Url: 'https://cdn.example.com/cakes/legacy-converted.png',
    });
  });

  it('keeps an external camel-case ImageValue contract unchanged', () => {
    const image = {
      name: 'external.png',
      converteName: 'external-converted.png',
      key: 'cakes/external-converted.png',
      s3Url: 'https://cdn.example.com/cakes/external-converted.png',
    };

    expect(ImageExternalMapper.toValue(image)).toEqual(image);
  });
});
