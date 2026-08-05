import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ConfigModule, ConfigType } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { UserModule } from './modules/user/user.module';
import { APP_GUARD, APP_PIPE } from '@nestjs/core';
import { CakeModule } from './modules/cake/cake.module';
import { AuthModule } from './platform/auth/auth.module';
import { LikeModule } from './modules/like/like.module';
import { StoreModule } from './modules/store/store.module';
import { SearchModule } from './modules/search/search.module';
import { CurationModule } from './modules/curation/curation.module';
import { HomeModule } from './modules/home/home.module';
import { RankingModule } from './modules/ranking/ranking.module';
import { AnniversaryModule } from './modules/anniversary/anniversary.module';
import { CounterModule } from './modules/counter/counter.module';
import { PrometheusEndpointModule } from './platform/observability/prometheus/prometheus-endpoint.module';
import { FirebaseAuthGuard } from './platform/auth/guard/firebase-auth.guard';
import { RolesGuard } from './platform/auth/guard/roles.guard';
import { createValidationPipe } from './app.validation';
import { CatalogQueryModule } from './modules/catalog/catalog-query.module';
import databaseConfig from './platform/config/database.config';
import appConfig from './platform/config/app.config';
import authConfig from './platform/config/auth.config';
import { HealthModule } from './platform/health/health.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: false,
      load: [appConfig, authConfig],
    }),
    ScheduleModule.forRoot(),
    MongooseModule.forRootAsync({
      imports: [ConfigModule.forFeature(databaseConfig)],
      connectionName: 'kezzle',
      inject: [databaseConfig.KEY],
      useFactory: (config: ConfigType<typeof databaseConfig>) => ({
        uri: config.uri,
        user: config.username,
        pass: config.password,
        dbName: config.dbName,
      }),
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
    PrometheusEndpointModule,
    HealthModule,
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
