import { Injectable } from '@nestjs/common';
import { HomeView } from '../application/home.view';
import { HomeResponseDto } from './dto/home-response.dto';

@Injectable()
export class HomePresenter {
  response(view: HomeView): HomeResponseDto {
    return new HomeResponseDto(view);
  }
}
