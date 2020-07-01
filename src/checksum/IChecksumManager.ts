// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { PassThrough } from "stream";

export default interface IChecksumManager {
    passThroughStream: PassThrough;
    finalize: () => string;
}