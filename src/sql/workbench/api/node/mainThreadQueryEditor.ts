/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { SqlExtHostContext, SqlMainContext, ExtHostQueryEditorShape, MainThreadQueryEditorShape } from 'sql/workbench/api/node/sqlExtHost.protocol';
import { IExtHostContext } from 'vs/workbench/api/common/extHost.protocol';
import { extHostNamedCustomer } from 'vs/workbench/api/common/extHostCustomers';
import { IConnectionManagementService, IConnectionCompletionOptions, ConnectionType, RunQueryOnConnectionMode } from 'sql/platform/connection/common/connectionManagement';
import { QueryEditor } from 'sql/workbench/parts/query/browser/queryEditor';
import { IEditorService } from 'vs/workbench/services/editor/common/editorService';
import { dispose, IDisposable } from 'vs/base/common/lifecycle';
import { IQueryModelService } from 'sql/platform/query/common/queryModel';
import * as azdata from 'azdata';
import { IQueryManagementService } from 'sql/platform/query/common/queryManagement';

@extHostNamedCustomer(SqlMainContext.MainThreadQueryEditor)
export class MainThreadQueryEditor implements MainThreadQueryEditorShape {

	private _proxy: ExtHostQueryEditorShape;
	private _toDispose: IDisposable[];

	constructor(
		extHostContext: IExtHostContext,
		@IConnectionManagementService private _connectionManagementService: IConnectionManagementService,
		@IQueryModelService private _queryModelService: IQueryModelService,
		@IEditorService private _editorService: IEditorService,
		@IQueryManagementService private _queryManagementService: IQueryManagementService
	) {
		if (extHostContext) {
			this._proxy = extHostContext.getProxy(SqlExtHostContext.ExtHostQueryEditor);
		}
		this._toDispose = [];
	}

	public dispose(): void {
		this._toDispose = dispose(this._toDispose);
	}

	public $connect(fileUri: string, connectionId: string): Thenable<void> {
		return new Promise<void>((resolve, reject) => {
			let editors = this._editorService.visibleControls.filter(resource => {
				return !!resource && resource.input.getResource().toString() === fileUri;
			});
			let editor = editors && editors.length > 0 ? editors[0] : undefined;
			let options: IConnectionCompletionOptions = {
				params: { connectionType: ConnectionType.editor, runQueryOnCompletion: RunQueryOnConnectionMode.none, input: editor ? editor.input as any : undefined },
				saveTheConnection: false,
				showDashboard: false,
				showConnectionDialogOnError: true,
				showFirewallRuleOnError: true,
			};
			if (connectionId) {
				let connection = this._connectionManagementService.getActiveConnections().filter(c => c.id === connectionId);
				if (connection && connection.length > 0) {
					this._connectionManagementService.connect(connection[0], fileUri, options).then(() => {
						resolve();
					}).catch(error => {
						reject(error);
					});
				} else {
					resolve();
				}
			} else {
				resolve();
			}
		});
	}

	public $runQuery(fileUri: string): void {
		let filteredEditors = this._editorService.visibleControls.filter(editor => editor.input.getResource().toString() === fileUri);
		if (filteredEditors && filteredEditors.length > 0) {
			let editor = filteredEditors[0];
			if (editor instanceof QueryEditor) {
				let queryEditor: QueryEditor = editor;
				queryEditor.runCurrentQuery();
			}
		}
	}

	public $registerQueryInfoListener(handle: number, providerId: string): void {
		this._toDispose.push(this._queryModelService.onQueryEvent(event => {
			this._proxy.$onQueryEvent(handle, event.uri, event);
		}));
	}

	public $createQueryTab(fileUri: string, title: string, componentId: string): void {
		let editors = this._editorService.visibleControls.filter(resource => {
			return !!resource && resource.input.getResource().toString() === fileUri;
		});

		let editor = editors && editors.length > 0 ? editors[0] : undefined;
		if (editor) {
			let queryEditor = editor as QueryEditor;
			if (queryEditor) {
				queryEditor.registerQueryModelViewTab(title, componentId);
			}
		}
	}

	public $setQueryExecutionOptions(fileUri: string, options: azdata.QueryExecutionOptions): Thenable<void> {
		return this._queryManagementService.setQueryExecutionOptions(fileUri, options);
	}
}
