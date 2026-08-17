export interface AgentIntent {
  intentName: string;
  department: string;
  confidence: number;
  extractedParams: Record<string, any>;
  missingFields: string[];
  requiresConfirmation: boolean;
  proposedActionPayload?: any;
  summaryText?: string;
  followUpPrompt?: string;
}

export interface AgentContext {
  userId: number;
  userRole: string;
  departmentCode: string;
  language: 'en' | 'ur';
}

export abstract class BaseAgent {
  abstract department: string;

  abstract processMessage(
    userInput: string,
    context: AgentContext,
    sessionState?: any
  ): Promise<AgentIntent>;

  abstract executeConfirmedAction(
    payload: any,
    context: AgentContext
  ): Promise<{ success: boolean; resultData: any; message: string }>;
}
