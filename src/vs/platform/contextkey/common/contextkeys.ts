/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { RawContextKey } from 'vs/platform/contextkey/common/contextkey';

export const InputFocusedContextKey = 'inputFocus';
export const InputFocusedContext = new RawContextKey<boolean>(InputFocusedContextKey, false);
