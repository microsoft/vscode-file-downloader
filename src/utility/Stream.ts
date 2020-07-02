// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { promisify } from "util";
import { pipeline, finished } from "stream";

export const finishedAsync = promisify(finished);
export const pipelineAsync = promisify(pipeline);
