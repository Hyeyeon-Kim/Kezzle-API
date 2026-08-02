import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { CakeLikeEventRecorder } from '../../application/port/cake-like-event-recorder.port';
import { CakeLikeEventRepository } from './cake-like-event.repository';
import { CakeLikeLog, CakeLikeLogSchema } from './cake-like-event.schema';

@Module({
  imports: [
    MongooseModule.forFeature(
      [{ name: CakeLikeLog.name, schema: CakeLikeLogSchema }],
      'kezzle',
    ),
  ],
  providers: [
    CakeLikeEventRepository,
    { provide: CakeLikeEventRecorder, useExisting: CakeLikeEventRepository },
  ],
  exports: [CakeLikeEventRecorder],
})
export class LikeEventModule {}
