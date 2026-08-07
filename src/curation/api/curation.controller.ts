import { Controller, Get, Param, Post, Query } from '@nestjs/common';
import { CurationService } from 'src/curation/application/curation.service';
import { Public } from 'src/auth/decorators/public.decorator';
import { RolesAllowed } from 'src/auth/decorators/roles.decorator';
import { Roles } from 'src/user/domain/roles.enum';
import { CurationPresenter } from './curation.presenter';

@Controller('curation')
export class CurationController {
  constructor(private readonly curationService: CurationService) {}

  @Post()
  @RolesAllowed(Roles.ADMIN)
  async createNewCuration(
    @Query('keyword') keywords: string,
    @Query('disc') disc: string,
    @Query('note') note: string,
  ) {
    return CurationPresenter.created(
      await this.curationService.createCuration(keywords, disc, note),
    );
  }

  @Get(':id')
  @Public()
  async showCuration(
    @Param('id') curationId: string,
    @Query('page') page: string,
  ) {
    return CurationPresenter.detail(
      await this.curationService.showCuration(curationId, parseInt(page)),
    );
  }
}
