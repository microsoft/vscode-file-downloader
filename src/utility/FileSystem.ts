// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import * as util from "util";
import * as rimraf from "rimraf";

export const rimrafAsync = util.promisify(rimraf.sync);