import { BaseAgent, AgentContext, AgentIntent } from './base-agent.js';
import { CuttingAgent } from './cutting-agent.js';
import { CeoAgent } from './ceo-agent.js';
import {
  OrderMerchandisingAgent,
  ErpProcurementAgent,
  StoreAgent,
  StitchingAgent,
  WashingAgent,
  FinishingAgent,
  QcAgent,
  PackingAgent,
  ShipmentAgent,
  FinanceAgent,
} from './department-agents.js';

class AgentRegistry {
  private agents: Map<string, BaseAgent> = new Map();

  constructor() {
    this.registerAgent('CUTTING', new CuttingAgent());
    this.registerAgent('EXECUTIVE', new CeoAgent());
    this.registerAgent('CEO', new CeoAgent());
    this.registerAgent('GENERAL_MANAGER', new CeoAgent());
    this.registerAgent('OPERATIONS', new CeoAgent());
    this.registerAgent('MERCHANDISING', new OrderMerchandisingAgent());
    this.registerAgent('PROCUREMENT', new ErpProcurementAgent());
    this.registerAgent('STORE', new StoreAgent());
    this.registerAgent('STITCHING', new StitchingAgent());
    this.registerAgent('WASHING', new WashingAgent());
    this.registerAgent('FINISHING', new FinishingAgent());
    this.registerAgent('QUALITY', new QcAgent());
    this.registerAgent('QC', new QcAgent());
    this.registerAgent('PACKING', new PackingAgent());
    this.registerAgent('SHIPMENT', new ShipmentAgent());
    this.registerAgent('FINANCE', new FinanceAgent());
  }

  registerAgent(departmentKey: string, agent: BaseAgent): void {
    this.agents.set(departmentKey.toUpperCase(), agent);
  }

  getAgent(departmentKey: string): BaseAgent | undefined {
    return this.agents.get(departmentKey.toUpperCase());
  }

  async routeMessage(
    department: string,
    userInput: string,
    context: AgentContext,
    sessionState?: any
  ): Promise<AgentIntent> {
    const agent = this.getAgent(department) || this.getAgent('CUTTING');
    if (!agent) {
      throw new Error(`No AI agent registered for department "${department}"`);
    }
    return agent.processMessage(userInput, context, sessionState);
  }

  async executeConfirmation(
    department: string,
    payload: any,
    context: AgentContext
  ): Promise<{ success: boolean; resultData: any; message: string }> {
    const agent = this.getAgent(department) || this.getAgent('CUTTING');
    if (!agent) {
      throw new Error(`No AI agent registered for department "${department}"`);
    }
    return agent.executeConfirmedAction(payload, context);
  }
}

export const agentRegistry = new AgentRegistry();
