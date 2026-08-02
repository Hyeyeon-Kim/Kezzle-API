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
import { SearchModule } from './search/search.module';
import { CurationModule } from './curation/curation.module';
import { HomeModule } from './home/home.module';
import { RankingModule } from './ranking/ranking.module';
import { AnniversaryModule } from './anniversary/anniversary.module';
import { CounterModule } from './counter/counter.module';
import { MonitoringModule } from './monitoring/monitoring.module';
import { FirebaseAuthGuard } from './auth/guard/firebase-auth.guard';
import { RolesGuard } from './auth/guard/roles.guard';
import { createValidationPipe } from './app.validation';
import { CatalogQueryModule } from './catalog/catalog-query.module';

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
    // Static rank routes must be discovered before composing modules pull in
    // Search/Cake parameter-route controllers.
    RankingModule,
    CatalogQueryModule,
    UserModule,
    CakeModule,
    AuthModule,
    LikeModule,
    StoreModule,
    SearchModule,
    CurationModule,
    HomeModule,
    AnniversaryModule,
    CounterModule,
    MonitoringModule,
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
