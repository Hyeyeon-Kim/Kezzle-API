import { Injectable } from '@nestjs/common';
import { InjectConnection } from '@nestjs/mongoose';
import { Connection, PipelineStage } from 'mongoose';
import {
  PopularRankingCandidate,
  PopularRankingSourceQuery,
  PopularRankingSourceReader,
} from 'src/ranking/application/port/popular-ranking-source.reader';

const EVENT_COLLECTION = 'cakelikelogs';
const CAKE_COLLECTION = 'cakes';
const MAX_FINITE_SCORE = Number.MAX_VALUE;

interface PopularRankingSourceDocument {
  readonly _id: unknown;
  readonly total: number;
  readonly image?: {
    readonly name?: string;
    readonly converte_name?: string;
    readonly converteName?: string;
    readonly key?: string;
    readonly s3Url?: string;
  };
  readonly owner_store_id?: string;
  readonly tag_ins?: string[];
}

@Injectable()
export class MongoPopularRankingSourceAdapter
  implements PopularRankingSourceReader
{
  constructor(
    @InjectConnection('kezzle') private readonly connection: Connection,
  ) {}

  async findTop(
    query: PopularRankingSourceQuery,
  ): Promise<PopularRankingCandidate[]> {
    const pipeline: PipelineStage[] = [
      {
        $match: {
          createdAt: { $gte: query.start, $lte: query.end },
        },
      },
      {
        $group: {
          _id: '$cakeId',
          trueCount: {
            $sum: { $cond: [{ $eq: ['$type', true] }, 1, 0] },
          },
          falseCount: {
            $sum: { $cond: [{ $eq: ['$type', false] }, 1, 0] },
          },
        },
      },
      {
        $set: {
          app_like: { $subtract: ['$trueCount', '$falseCount'] },
        },
      },
      {
        $lookup: {
          from: CAKE_COLLECTION,
          localField: '_id',
          foreignField: '_id',
          as: 'cake',
        },
      },
      { $unwind: '$cake' },
      { $match: { 'cake.is_delete': { $ne: true } } },
      {
        $project: {
          _id: 1,
          app_like: 1,
          image: '$cake.image',
          owner_store_id: '$cake.owner_store_id',
          like_ins: '$cake.like_ins',
          tag_ins: { $ifNull: ['$cake.tag_ins', []] },
        },
      },
      {
        $set: {
          legacy_like_score: {
            $convert: {
              input: '$like_ins',
              to: 'double',
              onError: 0,
              onNull: 0,
            },
          },
        },
      },
      {
        $set: {
          total: {
            $add: [
              {
                $multiply: [
                  {
                    $cond: [
                      {
                        $and: [
                          {
                            $gte: ['$legacy_like_score', -MAX_FINITE_SCORE],
                          },
                          {
                            $lte: ['$legacy_like_score', MAX_FINITE_SCORE],
                          },
                        ],
                      },
                      '$legacy_like_score',
                      0,
                    ],
                  },
                  0.2,
                ],
              },
              { $multiply: ['$app_like', 0.9] },
            ],
          },
        },
      },
      { $sort: { total: -1, _id: 1 } },
      { $limit: query.limit },
      {
        $project: {
          _id: 1,
          total: 1,
          image: 1,
          owner_store_id: 1,
          tag_ins: 1,
        },
      },
    ];

    const rows = await this.connection
      .collection(EVENT_COLLECTION)
      .aggregate<PopularRankingSourceDocument>(pipeline, {
        maxTimeMS: query.maxTimeMs,
      })
      .toArray();

    return rows.map((row) => {
      const total = Number(row.total);
      return {
        cakeId: String(row._id),
        total: Number.isFinite(total) ? total : 0,
        image:
          row.image == null
            ? undefined
            : {
                name: row.image.name,
                converteName: row.image.converteName ?? row.image.converte_name,
                key: row.image.key,
                s3Url: row.image.s3Url,
              },
        ownerStoreId: row.owner_store_id,
        tags: [...(row.tag_ins ?? [])],
      };
    });
  }
}
