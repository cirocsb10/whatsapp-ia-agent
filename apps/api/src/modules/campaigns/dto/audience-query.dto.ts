import { IsIn, IsString, IsUUID, ValidateIf } from "class-validator";

export class AudienceQueryDto {
  @IsIn(["all", "crm_stage"])
  type!: "all" | "crm_stage";

  @ValidateIf((o: AudienceQueryDto) => o.type === "crm_stage")
  @IsUUID()
  @IsString()
  stageId?: string;
}
