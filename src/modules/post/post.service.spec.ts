import { Test, TestingModule } from '@nestjs/testing';
import { PostService } from './post.service';
import { SurrealService } from '../../database/surreal.service';

describe('PostService', () => {
  let service: PostService;

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

    service = module.get<PostService>(PostService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
