import { ApiProperty } from '@nestjs/swagger';
import { ImageDto } from 'src/shared/image/api/image.dto';

export class DetailStoreResponseDto {
  @ApiProperty({
    description: '케이크 매장 ID(ObjectId)',
    example: '60b4d1b3e6b0b3001b9b9b9b',
  })
  readonly _id: string;

  @ApiProperty({
    description: '케이크 매장명',
  })
  readonly name: string;

  @ApiProperty({
    type: ImageDto,
    description: '케이크 매장 로고 사진',
    required: false,
  })
  readonly logo: ImageDto;

  @ApiProperty({
    description: '케이크 매장 주소',
  })
  readonly address: string;

  @ApiProperty({
    description: '매장 인스타그램 링크',
    required: false,
  })
  readonly insta_url: string;

  @ApiProperty({
    description: '매장 카카오 채널 링크',
    required: false,
  })
  readonly kakako_url: string;

  @ApiProperty({
    description: '케이크 매장 간단소개',
    example:
      '본비케이크만의 무드를 담은 케이크로 소중한 날을 더욱 특별하게 만들어드려요 :)',
    required: false,
  })
  readonly store_feature: string;

  @ApiProperty({
    description: '상세보기 케이크 매장소개',
    example:
      '안녕하세요~ 저희매장은 소중한날 행복할 수 있도록 정성스럽게 제작해드리겠습니다:) 공지사항....',
    required: false,
  })
  readonly store_description: string;

  @ApiProperty({
    description: '케이크 매장 전화번호',
    required: false,
  })
  readonly phone_number: string;

  @ApiProperty({
    type: [ImageDto],
    description: '케이크 매장 소개 사진들',
    required: false,
  })
  readonly detail_images: ImageDto[];

  @ApiProperty({
    description: '케이크 매장 오픈 시간 ',
    example: '[10:00 ~ 17:00, 09:00 ~ 16:00, ...]',
    required: false,
  })
  readonly operating_time: string[];

  @ApiProperty({
    type: String,
    description: '매장이 소유한 케이크 맛 ',
    example: '[초코, 딸기, 당근]',
  })
  readonly taste: string[];

  @ApiProperty({
    type: Boolean,
    description: '로그인한 유저가 좋아요 눌렀는지',
    example: true,
  })
  readonly is_liked: boolean;

  @ApiProperty({
    type: Boolean,
    description: '매장에서 받은 좋아요 수',
    example: '10',
  })
  readonly like_cnt: number;

  @ApiProperty({
    description: '매장에서 유저가 설정한 위치와 거리',
    example: '12041.93542697711 == 12.041(km)',
  })
  readonly distance: string;

  @ApiProperty({
    description: '위도',
    example: '3x.xxx',
  })
  readonly latitude: number;

  @ApiProperty({
    description: '경도',
    example: '12x.xxxxxx',
  })
  readonly longitude: number;

  @ApiProperty({
    description: '매장 카카오맵 링크',
    required: false,
  })
  readonly kakao_map_url: string;

  constructor(data: any, userid: string) {
    this._id = data?.id ?? data?._id;
    this.name = data?.name;
    this.logo = data?.logo == null ? data?.logo : new ImageDto(data.logo);
    this.store_feature = data?.feature ?? data?.store_feature;
    this.store_description = data?.description ?? data?.store_description;
    this.insta_url = data?.instagramUrl ?? data?.insta_url;
    this.kakako_url = data?.kakaoChannelUrl ?? data?.kakako_url;
    this.address = data?.address;
    this.phone_number = data?.phoneNumber ?? data?.phone_number;
    this.detail_images = (data?.detailImages ?? data?.detail_images ?? []).map(
      (image) => new ImageDto(image),
    );
    this.operating_time = data?.operatingTime ?? data?.operating_time;
    this.taste = data?.taste;
    const likedUserIds = data?.likedUserIds ?? data?.user_like_ids ?? [];
    this.is_liked = likedUserIds.includes(userid);
    this.like_cnt = likedUserIds.length;
    this.longitude =
      data?.location?.longitude ??
      data?.location?.coordinates?.[0] ??
      data?.longitude;
    this.latitude =
      data?.location?.latitude ??
      data?.location?.coordinates?.[1] ??
      data?.latitude;
    this.kakao_map_url = data?.kakaoMapUrl ?? data?.kakao_map_url;
    this.distance = data?.distance;
  }
}
