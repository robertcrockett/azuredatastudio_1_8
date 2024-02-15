/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

import * as azdata from 'azdata';
import * as vscode from 'vscode';
import { AppContext } from '../appContext';
import { getErrorMessage } from '../utils';
import * as SqlClusterLookUp from '../sqlClusterLookUp';

export class OpenSparkYarnHistoryTask {
	constructor(private appContext: AppContext) {
	}

	async execute(sqlConnProfile: azdata.IConnectionProfile, isSpark: boolean): Promise<void> {
		try {
			let sqlClusterConnection = SqlClusterLookUp.findSqlClusterConnection(sqlConnProfile, this.appContext);
			if (!sqlClusterConnection) {
				let name = isSpark ? 'Spark' : 'Yarn';
				this.appContext.apiWrapper.showErrorMessage(`Please connect to the Spark cluster before View ${name} History.`);
				return;
			}
			if (isSpark) {
				vscode.commands.executeCommand('vscode.open', vscode.Uri.parse(this.generateSparkHistoryUrl(sqlClusterConnection.host, sqlClusterConnection.port)));
			}
			else {
				vscode.commands.executeCommand('vscode.open', vscode.Uri.parse(this.generateYarnHistoryUrl(sqlClusterConnection.host, sqlClusterConnection.port)));
			}
		} catch (error) {
			this.appContext.apiWrapper.showErrorMessage(getErrorMessage(error));
		}
	}

	private generateSparkHistoryUrl(host: string, port: number): string {
		return `https://${host}:${port}/gateway/default/sparkhistory/`;
	}

	private generateYarnHistoryUrl(host: string, port: number): string {
		return `https://${host}:${port}/gateway/default/yarn/cluster/apps`;
	}
}
