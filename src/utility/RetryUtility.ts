// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

export class RetryUtility {
    public static async exponentialRetryAsync<T>(requestFn: () => Promise<T>, retries: number, delayInMs: number): Promise<T> {
        try {
            return await requestFn();
        }
        catch (error) {
            if (retries === 0) {
                throw error;
            }
            else {
                await new Promise((resolve): void => {
                    setTimeout(resolve, delayInMs);
                });
                return this.exponentialRetryAsync(requestFn, retries - 1, delayInMs * 2);
            }
        }
    }
}