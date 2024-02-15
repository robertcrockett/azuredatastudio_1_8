/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { IMainContext } from 'vs/workbench/api/common/extHost.protocol';
import { ExtHostQueryEditorShape, SqlMainContext, MainThreadQueryEditorShape } from 'sql/workbench/api/node/sqlExtHost.protocol';
import * as azdata from 'azdata';
import { IQueryEvent } from 'sql/platform/query/common/queryModel';

class ExtHostQueryDocument implements azdata.queryeditor.QueryDocument {
	constructor(
		public providerId: string,
		public uri: string,
		private _proxy: MainThreadQueryEditorShape) {
	}

	public setExecutionOptions(options: Map<string, any>): Thenable<void> {
		let executionOptions: azdata.QueryExecutionOptions = {
			options: options
		};
		return this._proxy.$setQueryExecutionOptions(this.uri, executionOptions);
	}

	public createQueryTab(tab: azdata.window.DialogTab): void {
		this._proxy.$createQueryTab(this.uri, tab.title, tab.content);
	}
}

export class ExtHostQueryEditor implements ExtHostQueryEditorShape {

	private _proxy: MainThreadQueryEditorShape;
	private _nextListenerHandle: number = 0;
	private _queryListeners = new Map<number, azdata.queryeditor.QueryEventListener>();

	constructor(
		mainContext: IMainContext
	) {
		this._proxy = mainContext.getProxy(SqlMainContext.MainThreadQueryEditor);
	}

	public $connect(fileUri: string, connectionId: string): Thenable<void> {
		return this._proxy.$connect(fileUri, connectionId);
	}

	public $runQuery(fileUri: string): void {
		return this._proxy.$runQuery(fileUri);
	}

	public $registerQueryInfoListener(providerId: string, listener: azdata.queryeditor.QueryEventListener): void {
		this._queryListeners[this._nextListenerHandle] = listener;
		this._proxy.$registerQueryInfoListener(this._nextListenerHandle, providerId);
		this._nextListenerHandle++;
	}

	public $onQueryEvent(handle: number, fileUri: string, event: IQueryEvent): void {
		let listener: azdata.queryeditor.QueryEventListener = this._queryListeners[handle];
		if (listener) {
			let planXml = event.params ? event.params.planXml : undefined;
			listener.onQueryEvent(event.type, new ExtHostQueryDocument('MSSQL', fileUri, this._proxy), planXml);
		}
	}

	public $getQueryDocument(fileUri: string): Thenable<azdata.queryeditor.QueryDocument> {
		return new Promise((resolve) => {
			resolve(new ExtHostQueryDocument('MSSQL', fileUri, this._proxy));
		});
	}

}
