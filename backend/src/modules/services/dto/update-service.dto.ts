import { IsString, IsNumber, IsOptional, IsBoolean, Min, IsArray, IsUUID, ValidateIf, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateServiceDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(10000, { message: 'Описание услуги не более 10000 символов' })
  description?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @ValidateIf((o) => !o.isCategory)
  @IsNumber()
  @Min(1)
  duration?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @ValidateIf((o) => !o.isCategory)
  @IsNumber()
  @Min(0)
  price?: number;

  @ApiProperty({ required: false, description: 'Флаг категории (без цены и времени)' })
  @IsOptional()
  @IsBoolean()
  isCategory?: boolean;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  category?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  imageUrl?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsNumber()
  bonusPointsPercent?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  masterIds?: string[]; // ID мастеров, которые предоставляют эту услугу

  @ApiProperty({ required: false, description: 'ID родительской услуги (для создания подкатегории)' })
  @IsOptional()
  @IsUUID('4')
  parentServiceId?: string | null;

  @ApiProperty({ required: false, description: 'Разрешить выбор нескольких подкатегорий (только для родительских услуг)' })
  @IsOptional()
  @IsBoolean()
  allowMultipleSubcategories?: boolean;
}

