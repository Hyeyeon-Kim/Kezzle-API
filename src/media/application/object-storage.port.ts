export interface PutObjectRequest {
  readonly key: string;
  readonly body: Buffer;
  readonly contentType: string;
}

export interface StoredObject {
  readonly key: string;
  readonly url: string;
}

export abstract class ObjectStoragePort {
  abstract put(request: PutObjectRequest): Promise<StoredObject>;
  abstract delete(key: string): Promise<void>;
}
