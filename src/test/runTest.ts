// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import * as path from 'path';

import { runTests } from '@vscode/test-electron';

const main = async () => {
    try {
        // The folder containing the Extension Manifest package.json
        // Passed to `--extensionDevelopmentPath`
        const extensionDevelopmentPath = path.resolve(__dirname, `../../`);

        // The path to test runner
        // Passed to --extensionTestsPath
        const extensionTestsPath = path.resolve(__dirname, `./suite/index`);

        // Download VS Code, unzip it and run the integration test
        await runTests({ extensionDevelopmentPath, extensionTestsPath });
    }
    catch (error) {
        // eslint-disable-next-line no-console
        console.error(`Failed to run tests`);
        process.exit(1);
    }
};

main();
