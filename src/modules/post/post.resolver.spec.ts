import { Test, TestingModule } from '@nestjs/testing';
import { PostResolver } from './post.resolver';
import { PostService } from './post.service';
import { SurrealService } from '../../database/surreal.service';

describe('PostResolver', () => {
  let resolver: PostResolver;

  beforeEach(async () => {
    const createPromise = {
      content: jest.fn(() => createPromise),
      json: jest.fn(() => Promise.resolve([])),
    };
    const updatePromise = {
      merge: jest.fn(() => updatePromise),
      json: jest.fn(() => Promise.resolve({})),
    };
    const selectPromise = {
      json: jest.fn(() => Promise.resolve([])),
    };
    const deletePromise = {
      json: jest.fn(() => Promise.resolve({})),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PostResolver,
        PostService,
        {
          provide: SurrealService,
          useValue: {
            client: {
              create: jest.fn(() => createPromise),
              select: jest.fn(() => selectPromise),
              update: jest.fn(() => updatePromise),
              delete: jest.fn(() => deletePromise),
            },
          },
        },
      ],
    }).compile();

    resolver = module.get<PostResolver>(PostResolver);
  });

  it('should be defined', () => {
    expect(resolver).toBeDefined();
  });
});
