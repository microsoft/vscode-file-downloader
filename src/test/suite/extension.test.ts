// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import * as assert from "assert";
import * as fs from "fs";
import * as path from "path";
import { ExtensionContext, extensions, Uri, window, CancellationTokenSource } from "vscode";
import IFileDownloader from "../../IFileDownloader";
import { rimrafAsync } from "../../utility/FileSystem";

/**
 * These tests will download files to C:\Users\<user>\AppData\Local\Programs\Microsoft VS Code\test-downloads\ and
 * delete both the files and the \test-downloads\ directory after the test is over
 */
const MockGlobalStoragePath = path.join(process.cwd(), `/test-downloads/`);
const MockExtensionContext = { globalStoragePath: MockGlobalStoragePath } as ExtensionContext;

const TestDownloadUri = Uri.parse(`https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf`);
const TestDownloadFilename = `test.pdf`;

suite(`Integration Tests`, () => {
    window.showInformationMessage(`Start all tests.`);

    let fileDownloader: IFileDownloader;

    suiteSetup(async () => {
        const downloaderExtension = extensions.getExtension(`mindaro.file-downloader`);
        assert(downloaderExtension);
        await downloaderExtension.activate();
        fileDownloader = downloaderExtension.exports;
    });

    teardown(async () => {
        await rimrafAsync(MockGlobalStoragePath);
    });

    test(`Activate extension`, () => {
        assert(fileDownloader);
    });

    test(`Simple download`, async () => {
        assert(
            await fileDownloader.downloadFile(
                TestDownloadUri,
                TestDownloadFilename,
                MockExtensionContext
            )
        );
    });

    test(`Get item with no downloads`, async () => {
        await assert.rejects(fileDownloader.getItem(TestDownloadFilename, MockExtensionContext));
    });

    test(`Get item with one download`, async () => {
        const downloadedUri: Uri = await fileDownloader.downloadFile(TestDownloadUri, TestDownloadFilename, MockExtensionContext);
        const getItemResult: Uri = await fileDownloader.getItem(TestDownloadFilename, MockExtensionContext);
        assert.deepStrictEqual(downloadedUri, getItemResult);
        await assert.doesNotReject(fs.promises.access(getItemResult.fsPath));
    });

    test(`Get item with multiple downloads`, async () => {
        const downloadedItem1 = await fileDownloader.downloadFile(TestDownloadUri, `1.pdf`, MockExtensionContext);
        const downloadedItem2 = await fileDownloader.downloadFile(TestDownloadUri, `2.pdf`, MockExtensionContext);
        const downloadedItem3 = await fileDownloader.downloadFile(TestDownloadUri, `3.pdf`, MockExtensionContext);
        const getItem1 = await fileDownloader.getItem(`1.pdf`, MockExtensionContext);
        const getItem2 = await fileDownloader.getItem(`2.pdf`, MockExtensionContext);
        const getItem3 = await fileDownloader.getItem(`3.pdf`, MockExtensionContext);
        assert.deepStrictEqual(downloadedItem1, getItem1);
        assert.deepStrictEqual(downloadedItem2, getItem2);
        assert.deepStrictEqual(downloadedItem3, getItem3);
    });

    test(`Overwrite existing folder`, async () => {
        const fullDownloadFilePath = path.join(MockGlobalStoragePath, `file-downloader-downloads`, `file`);
        await fs.promises.mkdir(fullDownloadFilePath, { recursive: true });
        await assert.doesNotReject(fileDownloader.downloadFile(TestDownloadUri, `file`, MockExtensionContext));
    });

    test(`tryGetItem with no downloads`, async () => {
        const getItemResult = await fileDownloader.tryGetItem(TestDownloadFilename, MockExtensionContext);
        assert.equal(getItemResult, undefined);
    });

    test(`tryGetItem with one download`, async () => {
        const downloadedUri: Uri = await fileDownloader.downloadFile(TestDownloadUri, TestDownloadFilename, MockExtensionContext);
        const getItemResult: Uri | undefined = await fileDownloader.tryGetItem(TestDownloadFilename, MockExtensionContext);
        assert(getItemResult != null);
        assert.deepStrictEqual(downloadedUri, getItemResult);
        await assert.doesNotReject(fs.promises.access(getItemResult.fsPath));
    });

    test(`List items with no downloads`, async () => {
        const result: Uri[] = await fileDownloader.listDownloadedItems(MockExtensionContext);
        assert.equal(result.length, 0);
    });

    test(`List items with one download`, async () => {
        const downloadedItemUri = await fileDownloader.downloadFile(TestDownloadUri, TestDownloadFilename, MockExtensionContext);
        const result: Uri[] = await fileDownloader.listDownloadedItems(MockExtensionContext);
        assert.equal(result.length, 1);
        assert.deepStrictEqual(downloadedItemUri, result[0]);
    });

    test(`List items with multiple downloads`, async () => {
        const downloadedItem1 = await fileDownloader.downloadFile(TestDownloadUri, `1.pdf`, MockExtensionContext);
        const downloadedItem2 = await fileDownloader.downloadFile(TestDownloadUri, `2.pdf`, MockExtensionContext);
        const downloadedItem3 = await fileDownloader.downloadFile(TestDownloadUri, `3.pdf`, MockExtensionContext);
        const result: Uri[] = await fileDownloader.listDownloadedItems(MockExtensionContext);
        assert.equal(result.length, 3);
        assert.deepStrictEqual(downloadedItem1.toString(), result[0].toString());
        assert.deepStrictEqual(downloadedItem2.toString(), result[1].toString());
        assert.deepStrictEqual(downloadedItem3.toString(), result[2].toString());
    });

    test(`Delete one item`, async () => {
        const downloadedItemUri = await fileDownloader.downloadFile(TestDownloadUri, TestDownloadFilename, MockExtensionContext);
        await assert.doesNotReject(fileDownloader.deleteItem(TestDownloadFilename, MockExtensionContext));
        assert.deepStrictEqual(await fileDownloader.listDownloadedItems(MockExtensionContext), []);
    });

    test(`Delete one item with no downloads`, async () => {
        await assert.doesNotReject(fileDownloader.deleteItem(TestDownloadFilename, MockExtensionContext));
    });

    test(`Delete one item out of multiple`, async () => {
        const downloadedItem1 = await fileDownloader.downloadFile(TestDownloadUri, `1.pdf`, MockExtensionContext);
        const downloadedItem2 = await fileDownloader.downloadFile(TestDownloadUri, `2.pdf`, MockExtensionContext);
        const downloadedItem3 = await fileDownloader.downloadFile(TestDownloadUri, `3.pdf`, MockExtensionContext);
        await fileDownloader.deleteItem(`1.pdf`, MockExtensionContext);
        const result: Uri[] = await fileDownloader.listDownloadedItems(MockExtensionContext);
        assert.equal(result.length, 2);
        assert.deepStrictEqual(downloadedItem2.toString(), result[0].toString());
        assert.deepStrictEqual(downloadedItem3.toString(), result[1].toString());
    });

    test(`Delete all items`, async () => {
        const downloadedItem1 = await fileDownloader.downloadFile(TestDownloadUri, `1.pdf`, MockExtensionContext);
        const downloadedItem2 = await fileDownloader.downloadFile(TestDownloadUri, `2.pdf`, MockExtensionContext);
        const downloadedItem3 = await fileDownloader.downloadFile(TestDownloadUri, `3.pdf`, MockExtensionContext);
        await fileDownloader.deleteAllItems(MockExtensionContext);
        assert.deepStrictEqual(await fileDownloader.listDownloadedItems(MockExtensionContext), []);
    });

    test(`Delete all items with no downloads`, async () => {
        await assert.doesNotReject(fileDownloader.deleteAllItems(MockExtensionContext));
    });

    test(`Download progress callback`, async () => {
        let reportedTotalBytes;
        let reportedDownloadedBytes;
        const downloadProgressCallback = (downloadedBytes: number, totalBytes: number | undefined) => {
            reportedDownloadedBytes = downloadedBytes;
            reportedTotalBytes = totalBytes ?? 0;
            assert(reportedTotalBytes === 0 || reportedDownloadedBytes <= reportedTotalBytes);
        };
        await fileDownloader.downloadFile(
            TestDownloadUri,
            TestDownloadFilename,
            MockExtensionContext,
            /* cancellationToken */ undefined,
            downloadProgressCallback
        );
        assert(reportedTotalBytes);
        assert(reportedDownloadedBytes);
        assert.equal(reportedDownloadedBytes, reportedTotalBytes);
    });

    test(`Decompress zip file`, async () => {
        const filePath = await fileDownloader.downloadFile(
            Uri.parse(`https://github.com/microsoft/cascadia-code/releases/download/v2005.15/CascadiaCode_2005.15.zip`),
            `cascadia`,
            MockExtensionContext,
            /* cancellationToken */ undefined,
            /* onDownloadProgressChange */ undefined,
            { shouldUnzip: true }
        );
        assert(filePath);
        assert(await fs.promises.readdir(filePath.fsPath));
    });

    test(`Decompress non-zip file`, () => {
        assert.rejects(
            fileDownloader.downloadFile(
                TestDownloadUri,
                TestDownloadFilename,
                MockExtensionContext,
                /* cancellationToken */ undefined,
                /* onDownloadProgressChange */ undefined,
                { shouldUnzip: true }
            )
        );
    });

    test(`Delete extracted folder`, async () => {
        const downloadedItemUri = await fileDownloader.downloadFile(
            Uri.parse(`https://github.com/microsoft/cascadia-code/releases/download/v2005.15/CascadiaCode_2005.15.zip`),
            `cascadia`,
            MockExtensionContext,
            /* cancellationToken */ undefined,
            /* onDownloadProgressChange */ undefined,
            { shouldUnzip: true }
        );
        await fileDownloader.deleteItem(`cascadia`, MockExtensionContext);
        assert.deepStrictEqual(await fileDownloader.listDownloadedItems(MockExtensionContext), []);
    });

    test(`Uri with no scheme`, async () => {
        await assert.rejects(
            fileDownloader.downloadFile(
                Uri.parse(`ipv4.download.thinkbroadband.com/5MB.zip`),
                TestDownloadFilename,
                MockExtensionContext
            )
        );
    });

    test(`Uri with improper scheme`, async () => {
        await assert.rejects(
            fileDownloader.downloadFile(
                Uri.parse(`scheme://ipv4.download.thinkbroadband.com/5MB.zip`),
                TestDownloadFilename,
                MockExtensionContext
            )
        );
    });

    test(`Nonexistent website with correct Uri format`, async () => {
        try {
            await fileDownloader.downloadFile(
                Uri.parse(`https://c0de104c1e68625629646025d15a6129a2b4b6496cd9ceacd7f7b5078e1849ba.com`),
                TestDownloadFilename,
                MockExtensionContext
            );
            assert.fail();
        }
        catch (error) {
            assert.equal(error.name, `RetriesExceededError`);
        }
    });

    test(`404 status code`, async () => {
        try {
            await fileDownloader.downloadFile(
                Uri.parse(`http://httpstat.us/404`),
                TestDownloadFilename,
                MockExtensionContext
            );
            assert.fail();
        }
        catch (error) {
            assert(error.response.status === 404);
            assert.notEqual(error.name, `RetriesExceededError`);
        }
    });

    test(`Cancel download`, async () => {
        const cancellationTokenSource = new CancellationTokenSource();
        const cancellationToken = cancellationTokenSource.token;
        const downloadPromise = fileDownloader.downloadFile(
            Uri.parse(`http://ipv4.download.thinkbroadband.com/50MB.zip`),
            `50MB.zip`,
            MockExtensionContext,
            cancellationToken
        );
        setTimeout(() => {
            cancellationTokenSource.cancel();
        }, 1000);
        try {
            await downloadPromise;
            assert.fail();
        }
        catch (error) {
            assert.equal(error.name, `DownloadCanceledError`);
        }
        const downloadedItems = await fileDownloader.listDownloadedItems(MockExtensionContext);
        assert.equal(downloadedItems.length, 0);
    });
});
