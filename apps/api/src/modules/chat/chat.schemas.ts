import type { ManualChatAnalysis as SharedManualChatAnalysis } from "@wfo/shared";

export {
  manualChatAnalysisRequestSchema,
  type ManualChatAnalysisRequest,
  type ManualChatAnalysisResponse,
  type ManualChatOrderAnalysis,
  type ParsedChatMessage,
  type PaymentStatus,
  type SenderType,
  type SuggestedReplyDto,
  type SuggestedReplyType
} from "@wfo/shared";

export type {
  ManualChatAnalysisSource
} from "@wfo/shared";

export type ManualChatAnalysis = SharedManualChatAnalysis & {
  customerMemoryUsed?: boolean;
  customerMemorySummary?: string | null;
};
