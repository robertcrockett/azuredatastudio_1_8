/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as nls from 'vscode-nls';

const localize = nls.loadMessageBundle();

export const extensionConfigSectionName = 'azure';
export const ViewType = 'view';

export enum BuiltInCommands {
	SetContext = 'setContext'
}

export const extensionName = localize('extensionName', 'Azure Accounts');
