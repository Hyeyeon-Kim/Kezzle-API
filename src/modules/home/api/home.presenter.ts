import { Injectable } from '@nestjs/common';
import { HomeFeedView } from '../application/home-feed.view';
import { HomeFeedResponseDto } from './dto/home-feed.response.dto';

@Injectable()
export class HomePresenter {
  response(view: HomeFeedView): HomeFeedResponseDto {
    return new HomeFeedResponseDto(view);
  }
}
