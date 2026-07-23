import { IsUUID } from "class-validator";

export class SyncTemplatesDto {
  @IsUUID()
  channelId!: string;
}
