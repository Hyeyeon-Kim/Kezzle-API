import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  INestApplication,
  Post,
  UnauthorizedException,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { IsString } from 'class-validator';
import request from 'supertest';
import { createValidationPipe } from 'src/app.validation';
import { CakeNotFoundException } from 'src/cake/domain/exception/cake-not-found.exception';
import contract from './fixtures/error-boundary.contract.json';

class ValidationRequest {
  @IsString()
  readonly name: string;
}

@Controller('__contracts/error-boundary')
class ErrorBoundaryContractController {
  @Post('validation')
  validate(@Body() body: ValidationRequest) {
    return body;
  }

  @Get('unauthorized')
  unauthorized(): never {
    throw new UnauthorizedException();
  }

  @Get('forbidden')
  forbidden(): never {
    throw new ForbiddenException('role is not allowed');
  }

  @Get('custom-not-found')
  customNotFound(): never {
    throw new CakeNotFoundException('missing-cake');
  }

  @Get('unknown')
  unknown(): never {
    throw new Error('internal-only-error-marker');
  }
}

describe('Nest default error boundary HTTP contract', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [ErrorBoundaryContractController],
    }).compile();

    app = moduleRef.createNestApplication();
    app.useLogger(false);
    app.useGlobalPipes(createValidationPipe());
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('keeps the representative 400 validation response', async () => {
    const expected = contract.cases.validation;
    const response = await request(app.getHttpServer())
      .post(expected.path)
      .send({ name: 123, unexpected: 'not allowed' })
      .expect(expected.status);

    expect(response.body).toEqual(expected.body);
  });

  it('keeps the representative 401 response', async () => {
    const expected = contract.cases.unauthorized;
    const response = await request(app.getHttpServer())
      .get(expected.path)
      .expect(expected.status);

    expect(response.body).toEqual(expected.body);
  });

  it('keeps the representative 403 response', async () => {
    const expected = contract.cases.forbidden;
    const response = await request(app.getHttpServer())
      .get(expected.path)
      .expect(expected.status);

    expect(response.body).toEqual(expected.body);
  });

  it('keeps the representative 404 CustomException response', async () => {
    const expected = contract.cases.customNotFound;
    const response = await request(app.getHttpServer())
      .get(expected.path)
      .expect(expected.status);

    expect(response.body).toEqual(expected.body);
  });

  it('keeps unknown 500 details and stack out of the response', async () => {
    const expected = contract.cases.unknown;
    const response = await request(app.getHttpServer())
      .get(expected.path)
      .expect(expected.status);

    expect(response.body).toEqual(expected.body);
    expect(response.text).not.toContain('internal-only-error-marker');
    expect(response.text).not.toContain('ErrorBoundaryContractController');
    expect(response.body).not.toHaveProperty('stack');
  });
});
