/**
 * File sau Nest `FileInterceptor` + memory storage (buffer).
 * Tách khỏi `Express.Multer.File` để tránh lỗi merge namespace với `moduleResolution: "nodenext"`.
 */
export type MemoryUploadedFile = {
  fieldname: string;
  originalname: string;
  encoding: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
};
