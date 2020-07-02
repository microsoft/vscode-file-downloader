// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { Writable } from "stream";
import * as unzipper from "unzipper";

const ZipDecompressor = (filePath: string): Writable => {
    const decompressor = unzipper.Extract({ path: filePath });
    return decompressor;
};

export default ZipDecompressor;