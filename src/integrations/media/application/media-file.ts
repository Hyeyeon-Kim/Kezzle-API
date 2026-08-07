export interface MediaFile {
  readonly originalName: string;
  readonly contentType: string;
  readonly buffer: Buffer;
}
