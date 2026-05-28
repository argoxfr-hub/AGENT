import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';

export enum LLMProvider {
  OPENROUTER = 'openrouter',
}

export enum AgentRole {
  PROJECT_MANAGER = 'project_manager',
  ANALYST = 'analyst',
  ARCHITECT = 'architect',
  BACKEND_DEV = 'backend_dev',
  FRONTEND_DEV = 'frontend_dev',
  DEVOPS = 'devops',
  QA = 'qa',
  WRITER = 'writer',
}

const AGENT_MODELS: Record<AgentRole, string> = {
  [AgentRole.PROJECT_MANAGER]: 'qwen/qwen3-235b-a22b:free',
  [AgentRole.ANALYST]:         'google/gemma-3-27b-it:free',
  [AgentRole.ARCHITECT]:       'qwen/qwen3-235b-a22b:free',
  [AgentRole.BACKEND_DEV]:     'meta-llama/llama-4-scout:free',
  [AgentRole.FRONTEND_DEV]:    'meta-llama/llama-4-scout:free',
  [AgentRole.DEVOPS]:          'meta-llama/llama-4-scout:free',
  [AgentRole.QA]:              'deepseek/deepseek-r1-0528:free',
  [AgentRole.WRITER]:          'qwen/qwen3-235b-a22b:free',
};

const FALLBACK_MODEL = 'meta-llama/llama-4-maverick:free';

export interface LLMMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface LLMResponse {
  content: string;
  provider: LLMProvider;
  model: string;
  tokens: { input: number; output: number };
}

@Injectable()
export class LLMRouterService {
  private readonly logger = new Logger(LLMRouterService.name);
  private client: OpenAI;

  constructor(private config: ConfigService) {
    this.client = new OpenAI({
      baseURL: 'https://openrouter.ai/api/v1',
      apiKey: config.get('OPENROUTER_API_KEY'),
      defaultHeaders: {
        'HTTP-Referer': config.get('APP_URL', 'https://localhost'),
        'X-Title': 'Multi-Agent System',
      },
    });
  }

  getPreferredProvider(role: AgentRole): LLMProvider {
    return LLMProvider.OPENROUTER;
  }

  getProvidersStatus(): Record<LLMProvider, boolean> {
    return { [LLMProvider.OPENROUTER]: true };
  }

  async complete(
    messages: LLMMessage[],
    role: AgentRole,
    options?: { provider?: LLMProvider; maxTokens?: number; temperature?: number }
  ): Promise<LLMResponse> {
    const model = AGENT_MODELS[role] || FALLBACK_MODEL;
    try {
      return await this.callModel(model, messages, options);
    } catch (err) {
      this.logger.warn(`Model ${model} failed: ${err.message}. Fallback...`);
      return await this.callModel(FALLBACK_MODEL, messages, options);
    }
  }

  private async callModel(
    model: string,
    messages: LLMMessage[],
    options?: { maxTokens?: number; temperature?: number }
  ): Promise<LLMResponse> {
    const response = await this.client.chat.completions.create({
      model,
      messages: messages as any,
      max_tokens: options?.maxTokens || 2048,
      temperature: options?.temperature ?? 0.7,
    });

    return {
      content: response.choices[0].message.content || '',
      provider: LLMProvider.OPENROUTER,
      model: response.model,
      tokens: {
        input: response.usage?.prompt_tokens || 0,
        output: response.usage?.completion_tokens || 0,
      },
    };
  }
}