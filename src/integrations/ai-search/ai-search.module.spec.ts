import { HttpService } from '@nestjs/axios';
import { Test } from '@nestjs/testing';
import aiConfig from 'src/platform/config/ai.config';
import { AiSearchModule } from './ai-search.module';

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

    await module.close();
  });
});
