import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { UserModule } from './user/user.module';
import { APP_GUARD, APP_PIPE } from '@nestjs/core';
import { CakeModule } from './cake/cake.module';
import { AuthModule } from './auth/auth.module';
import { LikeModule } from './like/like.module';
import { StoreModule } from './store/store.module';
import { UploadModule } from './upload/upload.module';
import { SearchModule } from './search/search.module';
import { CurationModule } from './curation/curation.module';
import { LogModule } from './log/log.module';
import { AnniversaryModule } from './anniversary/anniversary.module';
import { CounterModule } from './counter/counter.module';
import { HomeResilienceMetricsModule } from './home-resilience/home-resilience-metrics.module';
import { HomeCacheModule } from './home-cache/home-cache.module';
import { MonitoringModule } from './monitoring/monitoring.module';
import { FirebaseAuthGuard } from './auth/guard/firebase-auth.guard';
import { RolesGuard } from './auth/guard/roles.guard';
import { createValidationPipe } from './app.validation';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    ScheduleModule.forRoot(),
    MongooseModule.forRoot(process.env.MONGODB_URL, {
      user: process.env.MONGODB_USERNAME,
      pass: process.env.MONGODB_PASSWORD,
      dbName: process.env.MONGODB_DBNAME_MAIN,
      connectionName: 'kezzle',
    }),
    UserModule,
    CakeModule,
    AuthModule,
    LikeModule,
    StoreModule,
    UploadModule,
    SearchModule,
    CurationModule,
    LogModule,
    AnniversaryModule,
    CounterModule,
    MonitoringModule,
    HomeResilienceMetricsModule,
    HomeCacheModule,
  ],
  controllers: [],
  providers: [
    {
      provide: APP_PIPE,
      useValue: createValidationPipe(),
    },
    {
      provide: APP_GUARD,
      useClass: FirebaseAuthGuard,
    },
    {
      provide: APP_GUARD,
      useClass: RolesGuard,
    },
  ],
})
export class AppModule {}
