import { Test, TestingModule } from '@nestjs/testing';
import { UserResolver } from './user.resolver';
import { UserService } from './user.service';
import { SurrealService } from 'src/database/surreal.service';

describe('UserResolver', () => {
  let resolver: UserResolver;

  beforeEach(async () => {
    const selectPromise = {
      json: jest.fn(() => Promise.resolve([])),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UserResolver,
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

    resolver = module.get<UserResolver>(UserResolver);
  });

  it('should be defined', () => {
    expect(resolver).toBeDefined();
  });
});
