import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Cake, CakeSchema } from './entities/cake.schema';
import { CakeRepository } from './cake.repository';

@Module({
  imports: [
    MongooseModule.forFeature(
      [{ name: Cake.name, schema: CakeSchema }],
      'kezzle',
    ),
  ],
  providers: [CakeRepository],
  exports: [CakeRepository],
})
export class CakeRepositoryModule {}
