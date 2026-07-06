import { Module } from '@nestjs/common';
import { StoreController } from './store.controller';
import { StoreService } from './store.service';
import { UploadModule } from 'src/upload/upload.module';
import { StoreRepositoryModule } from './store-repository.module';
import { CakeRepositoryModule } from 'src/cake/cake-repository.module';

@Module({
  imports: [UploadModule, StoreRepositoryModule, CakeRepositoryModule],
  controllers: [StoreController],
  providers: [StoreService],
  exports: [StoreService, StoreRepositoryModule],
})
export class StoreModule {}
