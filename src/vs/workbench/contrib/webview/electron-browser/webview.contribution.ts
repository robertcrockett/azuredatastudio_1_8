/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { registerSingleton } from 'vs/platform/instantiation/common/extensions';
import { IWebviewService } from 'vs/workbench/contrib/webview/common/webview';
import { WebviewService } from 'vs/workbench/contrib/webview/electron-browser/webviewService';

registerSingleton(IWebviewService, WebviewService, true);
