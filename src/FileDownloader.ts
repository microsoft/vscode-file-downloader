// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import * as fs from "fs";
import * as path from "path";
import * as extractZip from 'extract-zip';
import { CancellationToken, ExtensionContext, Uri, commands} from "vscode";
import { v4 as uuid } from "uuid";
import { rimrafAsync } from "./utility/FileSystem";
import IFileDownloader from "./IFileDownloader";
import IHttpRequestHandler from "./networking/IHttpRequestHandler";
import ILogger from "./logging/ILogger";
import { DownloadCanceledError, FileNotFoundError } from "./utility/Errors";

const DefaultTimeoutInMs = 5000;
const DefaultRetries = 5;
const DefaultRetryDelayInMs = 100;

export interface FileDownloadSettings {
    timeoutInMs?: number;
    retries?: number;
    retryDelayInMs?: number;
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

        // Everything inside this try is a dirty fix to try to make things more reliable. A better fix using piped streams properly is needed.
        try{
            // Fake report progress code while we wait for the real fix
            let progress = 0;
            const progressTimerId = setInterval(() => {
                if (progress <= 100) {
                    // TODO: the whole timer should be under this if.
                    if(onDownloadProgressChange != null){
                        onDownloadProgressChange(progress++, 100);
                    }
                }
                else{
                    clearInterval(progressTimerId);
                }
            }, 500);

            // Download the file
            const location = await commands.executeCommand(`_workbench.downloadResource`, Uri.parse(url.toString())) as Uri;

            // Unzip it or just copy it over
            if(await fs.existsSync(location.fsPath)){
                if(settings?.shouldUnzip ?? false){
                    await extractZip(location.fsPath, { dir: tempFileDownloadPath });
                }
                else{
                    await fs.copyFile(location.fsPath, tempFileDownloadPath, (error)=>{
                        if(error){
                            this._logger.error(`${error?.message}. Technical details: ${JSON.stringify(error)}`);
                            throw error;
                        }
                    });
                }
                // Remove the temp file downloaded by _workbench.downloadResource
                await rimrafAsync(location.fsPath);
                // Set progress to 100%
                if(onDownloadProgressChange != null){
                    clearInterval(progressTimerId);
                    onDownloadProgressChange(100,100);
                }
            }
            else{
                const err = new Error(`Failed to download file ${url.toString()}.`);
                this._logger.error(err.message);
                throw err;
            }
        }
        catch (error) {
            this._logger.error(`${error.message}. Technical details: ${JSON.stringify(error)}`);
            throw error;
        }

        if (cancellationToken?.isCancellationRequested ?? false) {
            await rimrafAsync(tempFileDownloadPath);
            throw new DownloadCanceledError();
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