import { BadRequestException } from '@nestjs/common';

export type SafeMediaType = {
  mime: string;
  extension: string;
  inline: boolean;
};

function ascii(buffer: Buffer, start: number, length: number): string {
  return buffer.subarray(start, start + length).toString('ascii');
}

export function detectSafeMediaType(buffer: Buffer): SafeMediaType {
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return { mime: 'image/jpeg', extension: '.jpg', inline: true };
  }
  if (
    buffer.length >= 8 &&
    buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
  ) {
    return { mime: 'image/png', extension: '.png', inline: true };
  }
  if (buffer.length >= 12 && ascii(buffer, 0, 4) === 'RIFF' && ascii(buffer, 8, 4) === 'WEBP') {
    return { mime: 'image/webp', extension: '.webp', inline: true };
  }
  if (buffer.length >= 6 && ['GIF87a', 'GIF89a'].includes(ascii(buffer, 0, 6))) {
    return { mime: 'image/gif', extension: '.gif', inline: true };
  }
  if (buffer.length >= 5 && ascii(buffer, 0, 5) === '%PDF-') {
    return { mime: 'application/pdf', extension: '.pdf', inline: false };
  }
  if (buffer.length >= 12 && ascii(buffer, 4, 4) === 'ftyp') {
    const brand = ascii(buffer, 8, 4);
    if (brand === 'qt  ') {
      return { mime: 'video/quicktime', extension: '.mov', inline: false };
    }
    return { mime: 'video/mp4', extension: '.mp4', inline: false };
  }
  throw new BadRequestException('Unsupported or invalid media file signature.');
}

export function safeDownloadName(filename: string, extension: string): string {
  const base = filename
    .replace(/\.[^.]+$/, '')
    .replace(/[^a-zA-Z0-9_-]/g, '_')
    .slice(0, 80) || 'media';
  return `${base}${extension}`;
}
