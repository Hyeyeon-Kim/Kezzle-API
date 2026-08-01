import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { CakeLikeEventReader } from '../../application/port/cake-like-event.reader';
import { CakeLikeEventRecorder } from '../../application/port/cake-like-event-recorder.port';
import { CakeLikeEventRepository } from './cake-like-event.repository';
import { CakeLikeLog, CakeLikeLogSchema } from './cake-like-event.schema';

const likeEventPorts = [
  { provide: CakeLikeEventRecorder, useExisting: CakeLikeEventRepository },
  { provide: CakeLikeEventReader, useExisting: CakeLikeEventRepository },
];

@Module({
  imports: [
    MongooseModule.forFeature(
      [{ name: CakeLikeLog.name, schema: CakeLikeLogSchema }],
      'kezzle',
    ),
  ],
  providers: [CakeLikeEventRepository, ...likeEventPorts],
  exports: [CakeLikeEventRecorder, CakeLikeEventReader],
})
export class LikeEventModule {}
