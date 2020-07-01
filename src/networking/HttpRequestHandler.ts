// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { Readable } from "stream";
import axios, { AxiosRequestConfig, AxiosResponse } from "axios";
import { CancellationToken } from "vscode";
import ILogger from "../logging/ILogger";
import { RetriesExceededError, DownloadCanceledError } from "../utility/Errors";
import IHttpRequestHandler from "./IHttpRequestHandler";

export default class HttpRequestHandler implements IHttpRequestHandler {
    public constructor(private readonly _logger: ILogger) { }

    public async get(
        url: string,
        timeoutInMs: number,
        retries: number,
        retryDelayInMs: number,
        cancellationToken?: CancellationToken,
        onDownloadProgressChange?: (downloadedBytes: number, totalBytes: number) => void
    ): Promise<Readable> {
        const requestFn = () => this.getRequestHelper(
            url,
            timeoutInMs,
            cancellationToken,
            onDownloadProgressChange
        );
        return this.exponentialRetryHttpRequest(requestFn, retries, retryDelayInMs);
    }

    private async exponentialRetryHttpRequest(
        requestFn: () => Promise<Readable>,
        retries: number,
        delayInMs: number
    ): Promise<Readable> {
        try {
            return await requestFn();
        }
        catch (error) {
            if (retries === 0) {
                throw new RetriesExceededError();
            }
            const statusCode = error?.response?.status;
            if (statusCode != null && 400 <= statusCode && statusCode < 500) {
                throw error;
            }
            else {
                await new Promise(resolve => setTimeout(resolve, delayInMs));
                return this.exponentialRetryHttpRequest(requestFn, retries - 1, delayInMs * 2);
            }
        }
    }

    private async getRequestHelper(
        url: string,
        timeoutInMs: number,
        cancellationToken?: CancellationToken,
        onDownloadProgressChange?: (downloadedBytes: number, totalBytes: number) => void
    ): Promise<Readable> {
        const options: AxiosRequestConfig = {
            url: url,
            method: `get`,
            timeout: timeoutInMs,
            responseType: `stream`
        };

        if (cancellationToken != null) {
            const cancelToken = axios.CancelToken;
            const cancelTokenSource = cancelToken.source();
            cancellationToken.onCancellationRequested(() => cancelTokenSource.cancel());
            options.cancelToken = cancelTokenSource.token;
        }

        let response: AxiosResponse<Readable> | undefined;
        try {
            response = await axios(options);
        }
        catch (error) {
            this._logger.error(error.message);
            throw error;
        }

        const downloadStream: Readable = response.data;

        if (cancellationToken != null) {
            cancellationToken.onCancellationRequested(() => {
                downloadStream.destroy();
            });
        }

        if (onDownloadProgressChange != null) {
            const headers: { [key: string]: any } = response.headers;
            const contentLength = parseInt(headers[`content-length`], 10);
            const totalBytes = contentLength as number ?? undefined;
            let downloadedBytes = 0;

            downloadStream.on(`data`, (chunk: Buffer) => {
                downloadedBytes += chunk.length;
                if (onDownloadProgressChange != null) {
                    onDownloadProgressChange(downloadedBytes, totalBytes);
                }
            });
        }

        return downloadStream;
    }
}