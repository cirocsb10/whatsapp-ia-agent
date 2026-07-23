import { ArrayUnique, IsArray, IsString } from "class-validator";

export class UpdateMembersDto {
  @IsArray()
  @ArrayUnique()
  @IsString({ each: true })
  userIds!: string[];
}
