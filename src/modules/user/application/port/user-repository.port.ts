import { WriteResult } from 'src/shared/application/write-result';
import { CreateUserData, UpdateUserData } from '../user.command';
import { UserView } from '../user.view';

export abstract class UserRepositoryPort {
  abstract findByFirebaseUid(firebaseUid: string): Promise<UserView | null>;
  abstract findByFirebaseUidOrThrow(firebaseUid: string): Promise<UserView>;
  abstract findAll(): Promise<UserView[]>;
  abstract create(data: CreateUserData): Promise<UserView>;
  abstract update(
    firebaseUid: string,
    data: UpdateUserData,
  ): Promise<WriteResult>;
  abstract delete(firebaseUid: string): Promise<WriteResult>;
}
