/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { IConnectionManagementService } from 'sql/platform/connection/common/connectionManagement';
import * as azdata from 'azdata';
import * as TelemetryKeys from 'sql/platform/telemetry/telemetryKeys';
import * as TelemetryUtils from 'sql/platform/telemetry/telemetryUtilities';
import { ITelemetryService } from 'vs/platform/telemetry/common/telemetry';
import { IBackupService, TaskExecutionMode } from 'sql/platform/backup/common/backupService';
import { invalidProvider } from 'sql/base/common/errors';
import { ILogService } from 'vs/platform/log/common/log';

export class BackupService implements IBackupService {

	public _serviceBrand: any;
	private _providers: { [handle: string]: azdata.BackupProvider; } = Object.create(null);

	constructor(
		@IConnectionManagementService private _connectionService: IConnectionManagementService,
		@ITelemetryService private _telemetryService: ITelemetryService,
		@ILogService private logService: ILogService
	) {
	}

	/**
	 * Get database metadata needed to populate backup UI
	 */
	public getBackupConfigInfo(connectionUri: string): Thenable<azdata.BackupConfigInfo> {
		let providerId: string = this._connectionService.getProviderIdFromUri(connectionUri);
		if (providerId) {
			let provider = this._providers[providerId];
			if (provider) {
				return provider.getBackupConfigInfo(connectionUri);
			}
		}
		return Promise.resolve(undefined);
	}

	/**
	 * Backup a data source using the provided connection
	 */
	public backup(connectionUri: string, backupInfo: { [key: string]: any }, taskExecutionMode: TaskExecutionMode): Thenable<azdata.BackupResponse> {
		return new Promise<azdata.BackupResponse>((resolve, reject) => {
			const providerResult = this.getProvider(connectionUri);
			if (providerResult) {
				TelemetryUtils.addTelemetry(this._telemetryService, this.logService, TelemetryKeys.BackupCreated, { provider: providerResult.providerName });
				providerResult.provider.backup(connectionUri, backupInfo, taskExecutionMode).then(result => {
					resolve(result);
				}, error => {
					reject(error);
				});
			} else {
				reject(invalidProvider());
			}
		});
	}

	private getProvider(connectionUri: string): { provider: azdata.BackupProvider, providerName: string } {
		let providerId: string = this._connectionService.getProviderIdFromUri(connectionUri);
		if (providerId) {
			return { provider: this._providers[providerId], providerName: providerId };
		} else {
			return undefined;
		}
	}

	/**
	 * Register a disaster recovery provider
	 */
	public registerProvider(providerId: string, provider: azdata.BackupProvider): void {
		this._providers[providerId] = provider;
	}
}
