// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

// @ts-check

'use strict';

const path = require('path');
const LicenseCheckerWebpackPlugin = require("license-checker-webpack-plugin");

/**@type {import('webpack').Configuration}*/
const config = {
    target: `node`,
    entry: `./src/Extension.ts`,
    output: {
        path: path.resolve(__dirname, `dist`),
        filename: `extension.js`,
        libraryTarget: `commonjs2`,
        devtoolModuleFilenameTemplate: `../[resource-path]`
    },
    devtool: `source-map`,
    externals: {
        vscode: `commonjs vscode`
    },
    resolve: {
        extensions: [`.ts`, `.js`]
    },
    module: {
        rules: [
            {
                test: /\.ts$/,
                exclude: /node_modules/,
                use: [
                    {
                        loader: `ts-loader`
                    }
                ]
            }
        ]
    },
    plugins: [new LicenseCheckerWebpackPlugin({ outputFilename: "ThirdPartyNotices.txt", override: {"buffers@0.1.1": { licenseName: "MIT/X11" }} })]
};
module.exports = config;