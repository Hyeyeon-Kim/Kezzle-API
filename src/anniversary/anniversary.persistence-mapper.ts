import { AnniversaryView } from './application/anniversary.view';

export class AnniversaryPersistenceMapper {
  static toView(source: any): AnniversaryView {
    return {
      id: source?._id?.toString() ?? source?.id?.toString(),
      name: source?.name,
      keyword: [...(source?.keyword ?? [])],
      date: source?.date,
      mention: source?.ment,
    };
  }
}
