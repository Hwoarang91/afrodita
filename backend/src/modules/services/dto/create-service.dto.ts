import { IsString, IsNumber, IsOptional, IsBoolean, Min, IsArray, IsUUID, ValidateIf } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateServiceDto {
  @ApiProperty()
  @IsString()
  name: string;

  @ApiProperty()
  @IsString()
  description: string;

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

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  category?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  imageUrl?: string;

  @ApiProperty({ required: false, default: 0 })
  @IsOptional()
  @IsNumber()
  bonusPointsPercent?: number;

  @ApiProperty({ required: false, default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  masterIds?: string[]; // ID мастеров, которые предоставляют эту услугу

  @ApiProperty({ required: false, description: 'Флаг категории (без цены и времени)', default: false })
  @IsOptional()
  @IsBoolean()
  isCategory?: boolean;

  @ApiProperty({ required: false, description: 'ID родительской услуги (для создания подкатегории)' })
  @IsOptional()
  @IsUUID('4')
  parentServiceId?: string | null;

  @ApiProperty({ required: false, description: 'Разрешить выбор нескольких подкатегорий (только для категорий)', default: false })
  @IsOptional()
  @IsBoolean()
  allowMultipleSubcategories?: boolean;
}

