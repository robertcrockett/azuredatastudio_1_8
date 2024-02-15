/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { localize } from 'vs/nls';
import { tocData as vstocData, ITOCEntry } from 'vs/workbench/contrib/preferences/browser/settingsLayout';

// Copy existing table of contents and append
export const tocData: ITOCEntry = Object.assign({}, vstocData);
let sqlTocItems: ITOCEntry[] = [{
	id: 'data',
	label: localize('data', "Data"),
	children: [
		{
			id: 'data/connection',
			label: localize('connection', "Connection"),
			settings: ['startup.alwaysShowServersView', 'connection.*', 'serverGroup.*', 'datasource.*']
		},
		{
			id: 'data/query',
			label: localize('query', "Query"),
			settings: ['sql.query.*', 'resultsGrid.*']
		},
		{
			id: 'data/notebook',
			label: localize('notebook', "Notebook"),
			settings: ['notebook.*']
		},
		{
			id: 'data/sql',
			label: localize('sql', "SQL"),
			settings: ['sql.*']
		},
		{
			id: 'data/mssql',
			label: localize('mssql', "Microsoft SQL Server"),
			settings: ['mssql.*']
		},
		{
			id: 'data/dashboard',
			label: localize('dashboard', "Dashboard"),
			settings: ['dashboard.*']
		},
		{
			id: 'data/profiler',
			label: localize('profiler', "Profiler"),
			settings: ['profiler.*']
		}
	]
}];
tocData.children.push(...sqlTocItems);
