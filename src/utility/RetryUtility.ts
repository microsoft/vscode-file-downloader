// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { RetriesExceededError } from "./Errors";

export class RetryUtility {
    public static async exponentialRetryAsync<T>(
        requestFn: () => Promise<T>,
        retries: number,
        initialDelayInMs: number,
        errorHandlerFn?: (error: Error) => void
    ): Promise<T> {
        try {
            return await requestFn();
        }
        catch (error) {
            if (retries === 0) {
                throw new RetriesExceededError(error);
            }

            if (errorHandlerFn != null) {
                errorHandlerFn(error);
            }

            await new Promise((resolve): void => {
                setTimeout(resolve, initialDelayInMs);
            });
            return this.exponentialRetryAsync(requestFn, retries - 1, initialDelayInMs * 2, errorHandlerFn);
        }
    }
}