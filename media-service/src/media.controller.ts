import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  Post,
  Query,
  Res,
  UnauthorizedException,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import type { Response } from 'express';
import { MediaService } from './media.service';
import { getInternalServiceKey } from './secrets';

function assertInternalKey(key: string | undefined): void {
  if (key !== getInternalServiceKey()) {
    throw new UnauthorizedException('Invalid internal service key');
  }
}

@Controller('media')
export class MediaController {
  constructor(private readonly media: MediaService) {}

  /** Internal upload — called by product backends (Stays, Identity, …). */
  @Post('upload')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: 25 * 1024 * 1024 },
    }),
  )
  async upload(
    @Headers('x-internal-key') key: string | undefined,
    @UploadedFile() file: Express.Multer.File | undefined,
    @Body()
    body: { ownerService?: string; ownerUserId?: string; prefix?: string },
  ) {
    assertInternalKey(key);
    if (!file) throw new UnauthorizedException('No file provided');
    return this.media.upload({
      buffer: file.buffer,
      filename: file.originalname ?? 'upload.bin',
      mimeType: file.mimetype ?? 'application/octet-stream',
      ownerService: body.ownerService ?? 'unknown',
      ownerUserId: body.ownerUserId,
      prefix: body.prefix,
    });
  }

  /** Internal: mint a fresh signed URL for an existing asset. */
  @Post('signed-url')
  @HttpCode(200)
  async signedUrl(
    @Headers('x-internal-key') key: string | undefined,
    @Body() body: { storageKey: string; ttlSeconds?: number },
  ) {
    assertInternalKey(key);
    const metadata = await this.media.getMetadataByKey(body.storageKey);
    return {
      signedUrl: this.media.signedUrlFor(
        metadata.assetId,
        metadata.storageKey,
        body.ttlSeconds ?? 900,
      ),
    };
  }

  /** Public download via signed URL (HMAC + expiry validated). */
  @Get('file')
  async file(
    @Query('key') storageKey: string,
    @Query('exp') exp: string,
    @Query('sig') sig: string,
    @Res() res: Response,
  ) {
    this.media.verifySignature(storageKey, Number(exp), sig);
    const { buffer, metadata } = await this.media.getFile(storageKey);
    res.setHeader('Content-Type', metadata.mimeType);
    res.setHeader('Content-Length', String(metadata.sizeBytes));
    res.setHeader('Cache-Control', 'private, max-age=300');
    res.send(buffer);
  }
}
