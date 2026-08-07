import { HttpService } from '@nestjs/axios';
import { MODULE_METADATA } from '@nestjs/common/constants';
import { Test } from '@nestjs/testing';
import aiConfig from 'src/platform/config/ai.config';
import { ClipSearchPort } from '../application/clip-search.port';
import { VitSearchPort } from '../application/vit-search.port';
import { AiSearchModule } from '../ai-search.module';
import { ClipHttpAdapter } from './http/clip-http.adapter';
import { VitHttpAdapter } from './http/vit-http.adapter';

describe('AiSearchModule', () => {
  it('configures a finite shared Axios timeout from typed AI config', async () => {
    const module = await Test.createTestingModule({
      imports: [AiSearchModule],
    })
      .overrideProvider(aiConfig.KEY)
      .useValue({
        vitBaseUrl: 'http://vit.test',
        clipBaseUrl: 'http://clip.test',
        httpTimeoutMs: 4321,
      })
      .compile();

    expect(module.get(HttpService).axiosRef.defaults.timeout).toBe(4321);
    expect(module.get(ClipSearchPort)).toBe(module.get(ClipHttpAdapter));
    expect(module.get(VitSearchPort)).toBe(module.get(VitHttpAdapter));
    expect(
      Reflect.getMetadata(MODULE_METADATA.EXPORTS, AiSearchModule),
    ).toEqual([VitSearchPort, ClipSearchPort]);

    await module.close();
  });
});
