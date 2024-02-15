/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { IDisposable, dispose } from 'vs/base/common/lifecycle';
import {
	SqlExtHostContext, ExtHostCredentialManagementShape,
	MainThreadCredentialManagementShape, SqlMainContext
} from 'sql/workbench/api/node/sqlExtHost.protocol';
import { ICredentialsService } from 'sql/platform/credentials/common/credentialsService';
import * as azdata from 'azdata';
import { IExtHostContext } from 'vs/workbench/api/common/extHost.protocol';
import { extHostNamedCustomer } from 'vs/workbench/api/common/extHostCustomers';

@extHostNamedCustomer(SqlMainContext.MainThreadCredentialManagement)
export class MainThreadCredentialManagement implements MainThreadCredentialManagementShape {

	private _proxy: ExtHostCredentialManagementShape;

	private _toDispose: IDisposable[];

	private _registrations: { [handle: number]: IDisposable; } = Object.create(null);

	constructor(
		extHostContext: IExtHostContext,
		@ICredentialsService private credentialService: ICredentialsService
	) {
		if (extHostContext) {
			this._proxy = extHostContext.getProxy(SqlExtHostContext.ExtHostCredentialManagement);
		}
	}

	public dispose(): void {
		this._toDispose = dispose(this._toDispose);
	}

	public $registerCredentialProvider(handle: number): Promise<any> {
		let self = this;

		this._registrations[handle] = this.credentialService.addEventListener(handle, {
			onSaveCredential(credentialId: string, password: string): Thenable<boolean> {
				return self._proxy.$saveCredential(credentialId, password);
			},
			onReadCredential(credentialId: string): Thenable<azdata.Credential> {
				return self._proxy.$readCredential(credentialId);
			},
			onDeleteCredential(credentialId: string): Thenable<boolean> {
				return self._proxy.$deleteCredential(credentialId);
			}
		});

		return undefined;
	}

	public $unregisterCredentialProvider(handle: number): Promise<any> {
		let registration = this._registrations[handle];
		if (registration) {
			registration.dispose();
			delete this._registrations[handle];
		}
		return undefined;
	}
}
