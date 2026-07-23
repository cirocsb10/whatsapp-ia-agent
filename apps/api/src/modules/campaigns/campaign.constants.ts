export const CAMPAIGN_DISPATCH_QUEUE = "campaign-dispatch";

export const META_GRAPH_API = "https://graph.facebook.com/v21.0";

export type AudienceQuery =
  | { type: "all" }
  | { type: "crm_stage"; stageId: string };
