import { IsString, Matches, MaxLength, ValidateIf } from 'class-validator';
import { CreateProjectInput } from '../project';

export class CreateProjectDto implements CreateProjectInput {
  @IsString()
  @Matches(/\S/u, { message: 'name must contain a non-whitespace character' })
  @MaxLength(120)
  name!: string;

  @ValidateIf((_object, value) => value !== undefined)
  @IsString()
  @MaxLength(2000)
  description?: string;
}
