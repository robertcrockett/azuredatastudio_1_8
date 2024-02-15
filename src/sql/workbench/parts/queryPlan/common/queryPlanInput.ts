/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { EditorInput, EditorModel } from 'vs/workbench/common/editor';
import { UntitledEditorInput } from 'vs/workbench/common/editor/untitledEditorInput';
import { IConnectionProfile } from 'sql/platform/connection/common/interfaces';
import { ConnectionManagementInfo } from 'sql/platform/connection/common/connectionManagementInfo';

export class QueryPlanInput extends EditorInput {

	public static ID: string = 'workbench.editorinputs.queryplan';
	public static SCHEMA: string = 'queryplan';

	private _uniqueSelector: string;

	constructor(private _xml: string, private _uri: string, private _connection: ConnectionManagementInfo) {
		super();
	}

	public setUniqueSelector(uniqueSelector: string): void {
		this._uniqueSelector = uniqueSelector;
	}

	public getTypeId(): string {
		return UntitledEditorInput.ID;
	}

	public getName(): string {
		return 'Query Plan';
	}

	public get planXml(): string {
		return this._xml;
	}

	public getUri(): string {
		return this._uri;
	}

	public supportsSplitEditor(): boolean {
		return false;
	}

	public getConnectionProfile(): IConnectionProfile {
		//return this._connection.connectionProfile;
		return undefined;
	}

	public resolve(refresh?: boolean): Promise<EditorModel> {
		return undefined;
	}

	public get hasInitialized(): boolean {
		return !!this._uniqueSelector;
	}

	public get uniqueSelector(): string {
		return this._uniqueSelector;
	}

	public getConnectionInfo(): ConnectionManagementInfo {
		return this._connection;
	}
}
