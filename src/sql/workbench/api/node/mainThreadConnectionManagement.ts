/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { SqlExtHostContext, SqlMainContext, ExtHostConnectionManagementShape, MainThreadConnectionManagementShape } from 'sql/workbench/api/node/sqlExtHost.protocol';
import * as azdata from 'azdata';
import { IExtHostContext } from 'vs/workbench/api/common/extHost.protocol';
import { extHostNamedCustomer } from 'vs/workbench/api/common/extHostCustomers';
import { IConnectionManagementService, ConnectionType } from 'sql/platform/connection/common/connectionManagement';
import { IObjectExplorerService } from 'sql/workbench/services/objectExplorer/common/objectExplorerService';
import { IEditorService } from 'vs/workbench/services/editor/common/editorService';
import * as TaskUtilities from 'sql/workbench/common/taskUtilities';
import { IConnectionProfile } from 'sql/platform/connection/common/interfaces';
import { dispose, IDisposable } from 'vs/base/common/lifecycle';
import { isUndefinedOrNull } from 'vs/base/common/types';
import { generateUuid } from 'vs/base/common/uuid';
import { ICapabilitiesService } from 'sql/platform/capabilities/common/capabilitiesService';
import { ConnectionProfile } from 'sql/platform/connection/common/connectionProfile';
import { IConnectionDialogService } from 'sql/workbench/services/connection/common/connectionDialogService';

@extHostNamedCustomer(SqlMainContext.MainThreadConnectionManagement)
export class MainThreadConnectionManagement implements MainThreadConnectionManagementShape {

	private _proxy: ExtHostConnectionManagementShape;
	private _toDispose: IDisposable[];

	constructor(
		extHostContext: IExtHostContext,
		@IConnectionManagementService private _connectionManagementService: IConnectionManagementService,
		@IObjectExplorerService private _objectExplorerService: IObjectExplorerService,
		@IEditorService private _workbenchEditorService: IEditorService,
		@IConnectionDialogService private _connectionDialogService: IConnectionDialogService,
		@ICapabilitiesService private _capabilitiesService: ICapabilitiesService
	) {
		if (extHostContext) {
			this._proxy = extHostContext.getProxy(SqlExtHostContext.ExtHostConnectionManagement);
		}
		this._toDispose = [];
	}

	public dispose(): void {
		this._toDispose = dispose(this._toDispose);
	}

	public $getActiveConnections(): Thenable<azdata.connection.Connection[]> {
		return Promise.resolve(this._connectionManagementService.getActiveConnections().map(profile => this.convertConnection(profile)));
	}

	public $getCurrentConnection(): Thenable<azdata.connection.Connection> {
		return Promise.resolve(this.convertConnection(TaskUtilities.getCurrentGlobalConnection(this._objectExplorerService, this._connectionManagementService, this._workbenchEditorService, true)));
	}

	public $getCredentials(connectionId: string): Thenable<{ [name: string]: string }> {
		return Promise.resolve(this._connectionManagementService.getActiveConnectionCredentials(connectionId));
	}

	public $getServerInfo(connectionId: string): Thenable<azdata.ServerInfo> {
		return Promise.resolve(this._connectionManagementService.getServerInfo(connectionId));
	}

	public async $openConnectionDialog(providers: string[], initialConnectionProfile?: IConnectionProfile, connectionCompletionOptions?: azdata.IConnectionCompletionOptions): Promise<azdata.connection.Connection> {
		// Here we default to ConnectionType.editor which saves the connecton in the connection store by default
		let connectionType = ConnectionType.editor;

		// If the API call explicitly set saveConnection to false, set it to ConnectionType.extension
		// which doesn't save the connection by default
		if (connectionCompletionOptions && !connectionCompletionOptions.saveConnection) {
			connectionType = ConnectionType.temporary;
		}
		let connectionProfile = await this._connectionDialogService.openDialogAndWait(this._connectionManagementService,
			{ connectionType: connectionType, providers: providers }, initialConnectionProfile, undefined);
		const connection = connectionProfile ? {
			connectionId: connectionProfile.id,
			options: connectionProfile.options,
			providerName: connectionProfile.providerName
		} : undefined;

		if (connectionCompletionOptions && connectionCompletionOptions.saveConnection) {
			// Somehow, connectionProfile.saveProfile is false even if initialConnectionProfile.saveProfile is true, reset the flag here.
			connectionProfile.saveProfile = initialConnectionProfile.saveProfile;
			await this._connectionManagementService.connectAndSaveProfile(connectionProfile, undefined, {
				saveTheConnection: isUndefinedOrNull(connectionCompletionOptions.saveConnection) ? true : connectionCompletionOptions.saveConnection,
				showDashboard: isUndefinedOrNull(connectionCompletionOptions.showDashboard) ? false : connectionCompletionOptions.showDashboard,
				params: undefined,
				showConnectionDialogOnError: isUndefinedOrNull(connectionCompletionOptions.showConnectionDialogOnError) ? true : connectionCompletionOptions.showConnectionDialogOnError,
				showFirewallRuleOnError: isUndefinedOrNull(connectionCompletionOptions.showFirewallRuleOnError) ? true : connectionCompletionOptions.showFirewallRuleOnError
			});
		}
		return connection;
	}

	public async $listDatabases(connectionId: string): Promise<string[]> {
		let connectionUri = await this.$getUriForConnection(connectionId);
		let result = await this._connectionManagementService.listDatabases(connectionUri);
		return result.databaseNames;
	}

	public async $getConnectionString(connectionId: string, includePassword: boolean): Promise<string> {
		return this._connectionManagementService.getConnectionString(connectionId, includePassword);
	}

	public $getUriForConnection(connectionId: string): Thenable<string> {
		return Promise.resolve(this._connectionManagementService.getConnectionUriFromId(connectionId));
	}

	private convertConnection(profile: IConnectionProfile): azdata.connection.Connection {
		if (!profile) {
			return undefined;
		}
		profile = this._connectionManagementService.removeConnectionProfileCredentials(profile);
		let connection: azdata.connection.Connection = {
			providerName: profile.providerName,
			connectionId: profile.id,
			options: profile.options
		};
		return connection;
	}

	public $connect(connectionProfile: IConnectionProfile, saveConnection: boolean = true, showDashboard: boolean = true): Thenable<azdata.ConnectionResult> {
		let profile = new ConnectionProfile(this._capabilitiesService, connectionProfile);
		profile.id = generateUuid();
		return this._connectionManagementService.connectAndSaveProfile(profile, undefined, {
			saveTheConnection: saveConnection,
			showDashboard: showDashboard,
			params: undefined,
			showConnectionDialogOnError: true,
			showFirewallRuleOnError: true
		}).then((result) => {
			return <azdata.ConnectionResult>{
				connected: result.connected,
				connectionId: result.connected ? profile.id : undefined,
				errorCode: result.errorCode,
				errorMessage: result.errorMessage
			};
		});
	}
}
