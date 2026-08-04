import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import * as admin from 'firebase-admin';
import { ConfigType } from '@nestjs/config';
import appConfig from './config/app.config';
import firebaseConfig from './config/firebase.config';
import { validateEnvironment } from './config/environment.validation';

async function bootstrap() {
  validateEnvironment();
  const app = await NestFactory.create(AppModule);
  const application = app.get<ConfigType<typeof appConfig>>(appConfig.KEY);
  const firebase = app.get<ConfigType<typeof firebaseConfig>>(
    firebaseConfig.KEY,
  );

  const swaggerConfig = new DocumentBuilder()
    .setTitle('Kezzle API')
    .setDescription('The Kezzle API description')
    .setVersion('1.0')
    .addBearerAuth()
    .addSecurityRequirements('bearer')
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api-docs', app, document);

  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: firebase.projectId,
      privateKey: firebase.privateKey,
      clientEmail: firebase.clientEmail,
    }),
  });

  await app.listen(application.port);
}
bootstrap();
