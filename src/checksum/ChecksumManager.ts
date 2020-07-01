// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import * as crypto from "crypto";
import { PassThrough } from "stream";
import IChecksumManager from "./IChecksumManager";

const ChecksumManager = (algorithm: string): IChecksumManager => {
    const passThrough = new PassThrough();
    let hasher: crypto.Hash;
    try {
        hasher = crypto.createHash(algorithm);
    }
    catch (error) {
        throw new Error(`${error.message} - Supported checksum algorithms are: ${crypto.getHashes()}`);
    }
    return {
        passThroughStream: passThrough.pipe(hasher),
        finalize: () => hasher.digest(`hex`)
    };
};

export default ChecksumManager;