import { Test, TestingModule } from '@nestjs/testing';
import { UserService } from './user.service';
import { SurrealService } from 'src/database/surreal.service';

describe('UserService', () => {
  let service: UserService;

  beforeEach(async () => {
    const selectPromise = {
      json: jest.fn(() => Promise.resolve([])),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UserService,
        {
          provide: SurrealService,
          useValue: {
            client: {
              select: jest.fn(() => selectPromise),
            },
          },
        },
      ],
    }).compile();

    service = module.get<UserService>(UserService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
