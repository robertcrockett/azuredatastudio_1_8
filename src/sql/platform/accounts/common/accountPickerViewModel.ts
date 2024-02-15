/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import { Event, Emitter } from 'vs/base/common/event';

import { IAccountManagementService } from 'sql/platform/accounts/common/interfaces';
import { UpdateAccountListEventParams } from 'sql/platform/accounts/common/eventTypes';

/**
 * View model for account picker
 */
export class AccountPickerViewModel {
	// EVENTING ////////////////////////////////////////////////////////////
	private _updateAccountListEmitter: Emitter<UpdateAccountListEventParams>;
	public get updateAccountListEvent(): Event<UpdateAccountListEventParams> { return this._updateAccountListEmitter.event; }

	public selectedAccount: azdata.Account;

	constructor(
		private _providerId: string,
		@IAccountManagementService private _accountManagementService: IAccountManagementService
	) {
		// Create our event emitters
		this._updateAccountListEmitter = new Emitter<UpdateAccountListEventParams>();

		// Register handlers for any changes to the accounts
		this._accountManagementService.updateAccountListEvent(arg => this._updateAccountListEmitter.fire(arg));
	}

	// PUBLIC METHODS //////////////////////////////////////////////////////
	/**
	 * Loads an initial list of accounts from the account management service
	 * @return Promise to return the list of accounts
	 */
	public initialize(): Thenable<azdata.Account[]> {
		// Load a baseline of the accounts for the provider
		return this._accountManagementService.getAccountsForProvider(this._providerId)
			.then(undefined, () => {
				// In the event we failed to lookup accounts for the provider, just send
				// back an empty collection
				return [];
			});
	}
}
