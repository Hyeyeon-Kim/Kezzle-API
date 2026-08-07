import { Injectable } from '@nestjs/common';
import { ObjectId } from 'mongodb';
import { CakeCursorGeneratorPort } from '../../application/port/cake-cursor-generator.port';

@Injectable()
export class MongoObjectIdCakeCursorAdapter implements CakeCursorGeneratorPort {
  generate(): string {
    const timestamp = new ObjectId().getTimestamp();
    const timeValue = timestamp.getTime().toString().padStart(15, '0');
    const randomValue = Math.floor(Math.random() * 10000);

    return String(randomValue).padStart(6, '0') + timeValue;
  }
}
