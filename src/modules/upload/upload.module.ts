import { Module } from '@nestjs/common';
import { UploadController } from './upload.controller';
import { FirebaseStorageService } from './firebase-storage.service';

@Module({
  controllers: [UploadController],
  providers: [FirebaseStorageService],
  exports: [FirebaseStorageService],
})
export class UploadModule {}
