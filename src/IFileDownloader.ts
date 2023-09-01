// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { ExtensionContext, CancellationToken, Uri } from "vscode";

export interface FileDownloadSettings {
    /**
     * Timeout in milliseconds for the request.
     * @default 5000
     */
    timeoutInMs?: number;
    /**
     * Number of retries for the request.
     * @default 5
     */
    retries?: number;
    /**
     * Delay in milliseconds between retries.
     * @default 100
     */
    retryDelayInMs?: number;
    /**
     * Whether to unzip the downloaded file.
     * @default false
     */
    shouldUnzip?: boolean;
    /**
     * Whether to make the downloaded file executable.
     * @default false
     */
    makeExecutable?: boolean;
    /**
     * Additional headers to send with the request.
     * @default undefined
     * @example
     * {
     *   headers: {"Accept": `application/octet-stream`, "Content-Type": `application/octet-stream`}
     * }
     */
    headers?: Record<string, string | number | boolean> | undefined;
}

export default interface IFileDownloader {
    downloadFile(
        url: Uri,
        filename: string,
        context: ExtensionContext,
        cancellationToken?: CancellationToken,
        onDownloadProgressChange?: (downloadedBytes: number, totalBytes: number | undefined) => void,
        settings?: FileDownloadSettings
    ): Promise<Uri>;

    listDownloadedItems(context: ExtensionContext): Promise<Uri[]>;

    getItem(filename: string, context: ExtensionContext): Promise<Uri>;

    tryGetItem(filename: string, context: ExtensionContext): Promise<Uri | undefined>;

    deleteItem(filename: string, context: ExtensionContext): Promise<void>;

    deleteAllItems(context: ExtensionContext): Promise<void>;
}