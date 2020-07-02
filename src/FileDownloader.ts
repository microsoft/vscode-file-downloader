// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import * as fs from "fs";
import * as path from "path";
import { Readable, Writable } from "stream";
import { CancellationToken, ExtensionContext, Uri } from "vscode";
import { v4 as uuid } from "uuid";
import { rimrafAsync } from "./utility/FileSystem";
import ChecksumManager from "./checksum/ChecksumManager";
import IChecksumManager from "./checksum/IChecksumManager";
import IFileDownloader from "./IFileDownloader";
import IHttpRequestHandler from "./networking/IHttpRequestHandler";
import ILogger from "./logging/ILogger";
import { DownloadCanceledError, FileNotFoundError } from "./utility/Errors";
import ZipDecompressor from "./compression/ZipDecompressor";
import { pipelineAsync } from "./utility/Stream";

const DefaultTimeoutInMs = 5000;
const DefaultRetries = 5;
const DefaultRetryDelayInMs = 100;

export interface FileDownloadSettings {
    timeoutInMs?: number;
    retries?: number;
    retryDelayInMs?: number;
    checksum?: string;
    checksumAlgorithm?: string;
    shouldUnzip?: boolean;
}

export default class FileDownloader implements IFileDownloader {
    public constructor(
        private readonly _requestHandler: IHttpRequestHandler,
        private readonly _logger: ILogger
    ) { }

    private static getDownloadsStoragePath(context: ExtensionContext): string {
        return path.join(context.globalStoragePath, `file-downloader-downloads`);
    }

    public async downloadFile(
        url: Uri,
        filename: string,
        context: ExtensionContext,
        cancellationToken?: CancellationToken,
        onDownloadProgressChange?: (downloadedBytes: number, totalBytes: number | undefined) => void,
        settings?: FileDownloadSettings
    ): Promise<Uri> {
        if (url.scheme !== `http` && url.scheme !== `https`) {
            throw new Error(`Unsupported URI scheme in url. Supported schemes are http and https.`);
        }

        this._logger.log(`Starting download from ${url}`);

        const downloadsStoragePath: string = FileDownloader.getDownloadsStoragePath(context);
        // Generate a temporary filename for the download
        const tempFileDownloadPath: string = path.join(downloadsStoragePath, uuid());
        const fileDownloadPath: string = path.join(downloadsStoragePath, filename);
        await fs.promises.mkdir(downloadsStoragePath, { recursive: true });

        const timeoutInMs = settings?.timeoutInMs ?? DefaultTimeoutInMs;
        const retries = settings?.retries ?? DefaultRetries;
        const retryDelayInMs = settings?.retryDelayInMs ?? DefaultRetryDelayInMs;

        const streams: (NodeJS.ReadableStream | NodeJS.WritableStream | NodeJS.ReadWriteStream)[] = [];

        let checksumManager: IChecksumManager;
        if (settings?.checksum != null && settings.checksumAlgorithm != null) {
            checksumManager = ChecksumManager(settings.checksumAlgorithm);
            streams.push(checksumManager.passThroughStream);
        }
        else if (settings?.checksum != null) {
            throw new Error(`Provided checksum but didn't specify checksum algorithm.`);
        }
        else if (settings?.checksumAlgorithm != null) {
            throw new Error(`Specified checksum algorithm but didn't provide checksum to check against.`);
        }

        const downloadStream: Readable = await this._requestHandler.get(
            url.toString(),
            timeoutInMs,
            retries,
            retryDelayInMs,
            cancellationToken,
            onDownloadProgressChange
        );
        // Add to front of array, since pipeline() requires the readable stream to be the first element
        streams.unshift(downloadStream);

        const writeStream: Writable = settings?.shouldUnzip ?? false
            ? ZipDecompressor(tempFileDownloadPath)
            : fs.createWriteStream(tempFileDownloadPath);
        streams.push(writeStream);

        // Start the download and wait for it to completely finish writing to disk
        const pipelinePromise = pipelineAsync(streams);
        const writeStreamClosePromise = new Promise(resolve => writeStream.on(`close`, resolve));
        await Promise.all([pipelinePromise, writeStreamClosePromise]);

        if (cancellationToken?.isCancellationRequested ?? false) {
            await rimrafAsync(tempFileDownloadPath);
            throw new DownloadCanceledError();
        }

        if (checksumManager! != null) {
            this._logger.log(`Computing checksum...`);
            const hash = checksumManager.finalize();
            if (hash.toUpperCase() !== settings?.checksum?.toUpperCase()) {
                const message = `Checksums didn't match: Expected ${settings?.checksum}, downloaded ${hash}`;
                this._logger.log(message);
                throw new Error(message);
            }
            else {
                this._logger.log(`Checksums matched!`);
            }
        }

        // If the file/folder already exists, remove it now
        await rimrafAsync(fileDownloadPath);
        // Move the temp file/folder to its permanent location and return it
        await fs.promises.rename(tempFileDownloadPath, fileDownloadPath);
        return Uri.file(fileDownloadPath);
    }

    public async listDownloadedItems(context: ExtensionContext): Promise<Uri[]> {
        const downloadsStoragePath = FileDownloader.getDownloadsStoragePath(context);
        try {
            const filePaths: string[] = await fs.promises.readdir(downloadsStoragePath);
            return filePaths.map(filePath => Uri.file(path.join(downloadsStoragePath, filePath)));
        }
        catch (error) {
            if (error.code === `ENOENT`) {
                return [];
            }
            else {
                throw error;
            }
        }
    }

    public async getItem(filename: string, context: ExtensionContext): Promise<Uri> {
        const filePaths = await this.listDownloadedItems(context);
        const matchingUris = filePaths.filter((uri) => uri.path.split(`/`).pop() === filename.replace(`/`, ``));
        switch (matchingUris.length) {
            case 1:
                return matchingUris[0];
            case 0:
                throw new FileNotFoundError(path.join(FileDownloader.getDownloadsStoragePath(context), filename));
            default:
                throw new Error(`Unexpectedly found too many files or directories. Paths found: ${filePaths.map(uri => uri.toString())}`);
        }
    }

    public async tryGetItem(filename: string, context: ExtensionContext): Promise<Uri | undefined> {
        try {
            return await this.getItem(filename, context);
        }
        catch (error) {
            if (error instanceof FileNotFoundError) {
                return undefined;
            }
            else {
                throw error;
            }
        }
    }

    public async deleteItem(filename: string, context: ExtensionContext): Promise<void> {
        await rimrafAsync(path.join(FileDownloader.getDownloadsStoragePath(context), filename));
    }

    public async deleteAllItems(context: ExtensionContext): Promise<void> {
        await rimrafAsync(FileDownloader.getDownloadsStoragePath(context));
    }
}