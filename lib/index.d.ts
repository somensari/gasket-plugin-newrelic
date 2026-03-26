import type { Transaction } from 'newrelic';
import type { Plugin, MaybeAsync } from '@gasket/core';
import type { RequestLike } from '@gasket/request';

declare module '@gasket/core' {
  export interface GasketConfig {
    newrelic?: {
      /** Explicitly enable or disable the NR agent. Auto-detected from NEW_RELIC_LICENSE_KEY if omitted. */
      enabled?: boolean;
      errors?: {
        /** Skip 4xx client errors. Default: true */
        ignore4xx?: boolean;
        /** Skip 5xx server errors. Default: false */
        ignore5xx?: boolean;
      };
    };
  }

  export interface GasketActions {
    getNrTransaction(req: RequestLike): Promise<Transaction | void>;
  }

  export interface HookExecTypes {
    nrTransaction(
      transaction: Transaction,
      context: { req: import('@gasket/request').GasketRequest }
    ): MaybeAsync<void>;
    nrError(
      error: Error,
      attributes: Record<string, string | number | boolean>
    ): MaybeAsync<void>;
  }
}

declare const plugin: Plugin;
export default plugin;
