import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { UploadController } from './upload.controller';
import { FirebaseStorageService } from './firebase-storage.service';

@Module({
  imports: [AuthModule],
  controllers: [UploadController],
  providers: [FirebaseStorageService],
  exports: [FirebaseStorageService],
})
export class UploadModule {}
