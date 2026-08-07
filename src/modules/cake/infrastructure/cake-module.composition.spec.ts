import { MODULE_METADATA } from '@nestjs/common/constants';
import { CakeCursorGeneratorPort } from '../application/port/cake-cursor-generator.port';
import { CakeModule } from '../cake.module';
import { MongoObjectIdCakeCursorAdapter } from './persistence/mongo-object-id-cake-cursor.adapter';

describe('CakeModule', () => {
  it('binds the application cursor generator port to the MongoDB adapter', () => {
    const providers = Reflect.getMetadata(
      MODULE_METADATA.PROVIDERS,
      CakeModule,
    ) as unknown[];

    expect(providers).toEqual(
      expect.arrayContaining([
        MongoObjectIdCakeCursorAdapter,
        {
          provide: CakeCursorGeneratorPort,
          useExisting: MongoObjectIdCakeCursorAdapter,
        },
      ]),
    );
  });
});
