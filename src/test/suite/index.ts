// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import * as path from 'path';
import * as Mocha from 'mocha';
import * as glob from 'glob';

export const run = (): Promise<void> => {
    // Create the mocha test
    const mocha = new Mocha({
        ui: `tdd`,
        color: true,
        timeout: 10000
    });

    const testsRoot = path.resolve(__dirname, `..`);

    return new Promise((resolve, reject) => {
        glob(`**/**.test.js`, { cwd: testsRoot }, (error, files) => {
            if (error != null) {
                return reject(error);
            }

            // Add files to the test suite
            files.forEach(f => mocha.addFile(path.resolve(testsRoot, f)));

            try {
                // Run the mocha test
                mocha.run(failures => {
                    if (failures > 0) {
                        reject(new Error(`${failures} tests failed.`));
                    }
                    else {
                        resolve();
                    }
                });
            }
            catch (e) {
                reject(e);
            }
        });
    });
};
