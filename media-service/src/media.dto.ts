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

  /** Optional server-generated UUID from the calling service (key stability). */
  @IsOptional()
  @IsString()
  @MaxLength(36)
  @Matches(
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
  )
  assetId?: string;
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
