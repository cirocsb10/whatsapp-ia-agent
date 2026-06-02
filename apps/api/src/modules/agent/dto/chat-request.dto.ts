import { IsString, IsNotEmpty, MaxLength } from "class-validator";

export class ChatRequestDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  message!: string;
}
