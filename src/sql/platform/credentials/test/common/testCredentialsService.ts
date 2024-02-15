/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { ICredentialsService, CredentialManagementEvents } from 'sql/platform/credentials/common/credentialsService';
import { Credential } from 'azdata';
import { IDisposable } from 'vs/base/common/lifecycle';
import { Emitter } from 'vs/base/common/event';

export class TestCredentialsService implements ICredentialsService {
	_serviceBrand: any;

	public credentials = new Map<string, Credential>();

	private _onCredential = new Emitter<Credential>();
	public readonly onCredential = this._onCredential.event;

	saveCredential(credentialId: string, password: string): Promise<boolean> {
		let credential = { credentialId, password };
		this.credentials.set(credentialId, credential);
		this._onCredential.fire(credential);
		return Promise.resolve(true);
	}

	readCredential(credentialId: string): Promise<Credential> {
		let cred = this.credentials.get(credentialId);
		if (cred) {
			return Promise.resolve<Credential>(cred);
		} else {
			return Promise.reject('');
		}
	}

	deleteCredential(credentialId: string): Promise<boolean> {
		return Promise.resolve(this.credentials.delete(credentialId));
	}

	addEventListener(handle: number, events: CredentialManagementEvents): IDisposable {
		throw new Error('Method not implemented.');
	}
}
