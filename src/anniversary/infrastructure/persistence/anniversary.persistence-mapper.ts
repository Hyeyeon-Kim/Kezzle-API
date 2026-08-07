import { AnniversaryView } from 'src/anniversary/application/query/anniversary.view';

interface AnniversaryPersistenceSource {
  readonly _id?: unknown;
  readonly id?: unknown;
  readonly name?: string;
  readonly keyword?: string[];
  readonly date?: Date;
  readonly ment?: string;
}

function identifier(value: unknown): string | undefined {
  return value == null ? undefined : String(value);
}

export class AnniversaryPersistenceMapper {
  static toView(source: AnniversaryPersistenceSource): AnniversaryView {
    return {
      id: identifier(source?._id) ?? identifier(source?.id),
      name: source?.name,
      keyword: [...(source?.keyword ?? [])],
      date: source?.date,
      mention: source?.ment,
    };
  }
}
