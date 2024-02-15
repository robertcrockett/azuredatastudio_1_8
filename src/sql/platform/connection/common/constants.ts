/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { localize } from 'vs/nls';

// constants
export const sqlConfigSectionName = 'sql';
export const outputChannelName = 'MSSQL';

/* Memento constants */
export const capabilitiesOptions = 'OPTIONS_METADATA';

export const mssqlProviderName = 'MSSQL';
export const anyProviderName = '*';
export const connectionProviderContextKey = 'connectionProvider';

export const applicationName = 'azdata';

export const defaultEngine = 'defaultEngine';

export const passwordChars = '***************';

/* authentication types */
export const sqlLogin = 'SqlLogin';
export const integrated = 'Integrated';
export const azureMFA = 'AzureMFA';

/* CMS constants */
export const cmsProviderName = 'MSSQL-CMS';
export const cmsProviderDisplayName = localize('constants.cmsProviderDisplayName', 'Microsoft SQL Server - CMS');

export const UNSAVED_GROUP_ID = 'unsaved';
