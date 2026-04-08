import {
  Injectable,
  Logger,
  OnModuleInit,
  ServiceUnavailableException,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import { existsSync, readFileSync } from 'node:fs';
import { isAbsolute, resolve } from 'node:path';
import * as admin from 'firebase-admin';
import { appSettings } from '../../common/config/appSetting';
import type { MemoryUploadedFile } from './memory-uploaded-file.type';

type ServiceAccountJson = {
  project_id?: string;
  client_email?: string;
  private_key?: string;
};

@Injectable()
export class FirebaseStorageService implements OnModuleInit {
  private readonly logger = new Logger(FirebaseStorageService.name);
  private ready = false;
  /** Bucket thực tế sau khi suy ra từ project_id (file JSON) nếu chưa set env */
  private resolvedStorageBucket = '';

  onModuleInit() {
    const { firebase } = appSettings;

    if (admin.apps.length > 0) {
      this.resolvedStorageBucket =
        appSettings.firebase.storageBucket ||
        admin.app()?.options?.storageBucket ||
        '';
      this.ready = !!this.resolvedStorageBucket;
      return;
    }

    try {
      let storageBucket = firebase.storageBucket?.trim() ?? '';
      let credential: admin.ServiceAccount | null = null;

      if (firebase.serviceAccountPath?.trim()) {
        const abs = this.resolveCredentialPath(firebase.serviceAccountPath.trim());
        if (existsSync(abs)) {
          const raw = readFileSync(abs, 'utf8');
          const parsed = JSON.parse(raw) as ServiceAccountJson;
          credential = this.normalizeServiceAccount(parsed);
          if (!storageBucket && parsed.project_id) {
            storageBucket = `${parsed.project_id}.appspot.com`;
            this.logger.log(
              `Firebase: dùng bucket mặc định ${storageBucket} (từ project_id trong file JSON).`,
            );
          }
        } else {
          this.logger.warn(
            `Firebase: file không tồn tại — ${abs} (bỏ qua, thử nguồn credential khác).`,
          );
        }
      }

      if (!credential && firebase.serviceAccountJson?.trim()) {
        credential = this.normalizeServiceAccount(
          JSON.parse(firebase.serviceAccountJson) as ServiceAccountJson,
        );
        if (!storageBucket && credential.projectId) {
          storageBucket = `${credential.projectId}.appspot.com`;
        }
      }
      if (
        !credential &&
        firebase.projectId &&
        firebase.clientEmail &&
        firebase.privateKey
      ) {
        credential = {
          projectId: firebase.projectId,
          clientEmail: firebase.clientEmail,
          privateKey: firebase.privateKey.replace(/\\n/g, '\n'),
        };
      }

      if (!credential) {
        return;
      }
      if (!storageBucket) {
        this.logger.warn(
          'Firebase: thiếu FIREBASE_STORAGE_BUCKET và không suy ra được từ JSON (project_id).',
        );
        return;
      }

      this.resolvedStorageBucket = storageBucket;
      admin.initializeApp({
        credential: admin.credential.cert(credential),
        storageBucket,
      });
      this.ready = true;
      this.logger.log(`Firebase Admin đã khởi tạo (bucket: ${storageBucket}).`);
    } catch (e) {
      this.ready = false;
      this.logger.warn(
        `Firebase Admin init failed: ${e instanceof Error ? e.message : e}`,
      );
    }
  }

  private resolveCredentialPath(p: string): string {
    if (isAbsolute(p)) return p;
    return resolve(process.cwd(), p);
  }

  private normalizeServiceAccount(
    parsed: ServiceAccountJson,
  ): admin.ServiceAccount {
    const privateKey =
      typeof parsed.private_key === 'string'
        ? parsed.private_key.replace(/\\n/g, '\n')
        : '';
    return {
      projectId: parsed.project_id,
      clientEmail: parsed.client_email,
      privateKey,
    } as admin.ServiceAccount;
  }

  private ensureReady() {
    const bucket = this.resolvedStorageBucket || appSettings.firebase.storageBucket;
    if (!this.ready || !bucket) {
      throw new ServiceUnavailableException(
        'Chưa cấu hình Firebase Storage: file JSON (FIREBASE_SERVICE_ACCOUNT_PATH hoặc GOOGLE_APPLICATION_CREDENTIALS), hoặc FIREBASE_SERVICE_ACCOUNT_JSON / biến PROJECT_ID+EMAIL+KEY, và bucket (hoặc project_id trong JSON để dùng {project}.appspot.com).',
      );
    }
  }

  private getBucketName(): string {
    return this.resolvedStorageBucket || appSettings.firebase.storageBucket;
  }

  private extFromMimetype(mimetype: string): string {
    const map: Record<string, string> = {
      'image/jpeg': '.jpg',
      'image/png': '.png',
      'image/webp': '.webp',
      'image/gif': '.gif',
    };
    return map[mimetype] ?? '.bin';
  }

  /**
   * Upload một file ảnh vào bucket; trả về URL tải xem được (public hoặc signed).
   */
  async uploadUserImage(
    userId: string,
    file: MemoryUploadedFile,
  ): Promise<{
    url: string;
    storage_path: string;
    content_type: string;
    original_name: string;
  }> {
    this.ensureReady();
    const safeUser = String(userId).replace(/[^\w:.-]/g, '_');
    const ext = this.extFromMimetype(file.mimetype);
    const objectPath = `uploads/${safeUser}/${randomUUID()}${ext}`;

    const bucket = admin.storage().bucket(this.getBucketName());
    const ref = bucket.file(objectPath);

    await ref.save(file.buffer, {
      metadata: { contentType: file.mimetype },
      resumable: false,
    });

    let url: string;
    if (appSettings.firebase.publicRead) {
      try {
        await ref.makePublic();
        url = ref.publicUrl();
      } catch {
        const [signed] = await ref.getSignedUrl({
          action: 'read',
          expires: Date.now() + appSettings.firebase.signedUrlExpiresMs,
        });
        url = signed;
      }
    } else {
      const [signed] = await ref.getSignedUrl({
        action: 'read',
        expires: Date.now() + appSettings.firebase.signedUrlExpiresMs,
      });
      url = signed;
    }

    return {
      url,
      storage_path: objectPath,
      content_type: file.mimetype,
      original_name: file.originalname ?? 'upload',
    };
  }
}
