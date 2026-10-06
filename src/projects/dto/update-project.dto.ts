import { IsString, Matches, MaxLength, ValidateIf } from 'class-validator';
import { UpdateProjectInput } from '../project';

export class UpdateProjectDto implements UpdateProjectInput {
  @ValidateIf((_object, value) => value !== undefined)
  @IsString()
  @Matches(/\S/u, { message: 'name must contain a non-whitespace character' })
  @MaxLength(120)
  name?: string;

  @ValidateIf((_object, value) => value !== undefined)
  @IsString()
  @MaxLength(2000)
  description?: string;
}
