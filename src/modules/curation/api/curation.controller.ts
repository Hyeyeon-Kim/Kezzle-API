import { Controller, Get, Param, Post, Query } from '@nestjs/common';
import { CurationService } from 'src/modules/curation/application/curation.service';
import { Public } from 'src/platform/auth/decorators/public.decorator';
import { RolesAllowed } from 'src/platform/auth/decorators/roles.decorator';
import { Roles } from 'src/platform/auth/roles.enum';
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
