import { IsIn } from "class-validator";

export class CreateCheckoutDto {
  @IsIn(["STARTER", "GROWTH", "SCALE"])
  plan!: "STARTER" | "GROWTH" | "SCALE";
}
