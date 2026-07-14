import { Controller, Get, Param, Post, Query } from '@nestjs/common';
import { CurationService } from './curation.service';
import { Public } from 'src/auth/decorators/public.decorator';
import { RolesAllowed } from 'src/auth/decorators/roles.decorator';
import { Roles } from 'src/user/entities/roles.enum';

@Controller('curation')
export class CurationController {
  constructor(private readonly curationService: CurationService) {}

  @Post()
  @RolesAllowed(Roles.ADMIN)
  createNewCuration(
    @Query('keyword') keywords: string,
    @Query('disc') disc: string,
    @Query('note') note: string,
  ) {
    return this.curationService.createCuration(keywords, disc, note);
  }

  @Get()
  @Public()
  homeCuration() {
    return this.curationService.homeCuration();
  }

  @Get(':id')
  @Public()
  showCuration(@Param('id') curationId: string, @Query('page') page: string) {
    return this.curationService.showCuration(curationId, parseInt(page));
  }
}
