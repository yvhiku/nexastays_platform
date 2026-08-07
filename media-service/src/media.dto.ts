import { IsInt, IsOptional, IsString, Max, MaxLength, Min, Matches } from 'class-validator';
import { Type } from 'class-transformer';

export class UploadMediaDto {
  @IsOptional()
  @IsString()
  @MaxLength(40)
  @Matches(/^[a-zA-Z0-9_-]+$/)
  ownerService?: string;

  @IsOptional()
  @IsString()
  @MaxLength(128)
  ownerUserId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  @Matches(/^[a-zA-Z0-9_/-]+$/)
  prefix?: string;
}

export class SignedUrlDto {
  @IsString()
  @MaxLength(512)
  storageKey: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(60)
  @Max(3600)
  ttlSeconds?: number;
}
