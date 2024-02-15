/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import 'vs/css!./media/accountListRenderer';
import 'vs/css!./media/accountActions';
import 'vs/css!sql/media/icons/common-icons';

import * as DOM from 'vs/base/browser/dom';
import { IListRenderer, IListVirtualDelegate } from 'vs/base/browser/ui/list/list';
import { ActionBar, IActionOptions } from 'vs/base/browser/ui/actionbar/actionbar';
import { localize } from 'vs/nls';
import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';

import { RemoveAccountAction, RefreshAccountAction } from 'sql/platform/accounts/common/accountActions';

import * as azdata from 'azdata';

export class AccountListDelegate implements IListVirtualDelegate<azdata.Account> {

	constructor(
		private _height: number
	) {
	}

	public getHeight(element: azdata.Account): number {
		return this._height;
	}

	public getTemplateId(element: azdata.Account): string {
		return 'accountListRenderer';
	}
}

export interface AccountListTemplate {
	root: HTMLElement;
	icon: HTMLElement;
	badgeContent: HTMLElement;
	contextualDisplayName: HTMLElement;
	label: HTMLElement;
	displayName: HTMLElement;
	content?: HTMLElement;
	actions?: ActionBar;
}

export class AccountPickerListRenderer implements IListRenderer<azdata.Account, AccountListTemplate> {
	public static TEMPLATE_ID = 'accountListRenderer';

	public get templateId(): string {
		return AccountPickerListRenderer.TEMPLATE_ID;
	}

	public renderTemplate(container: HTMLElement): AccountListTemplate {
		const tableTemplate: AccountListTemplate = Object.create(null);
		const badge = DOM.$('div.badge');
		tableTemplate.root = DOM.append(container, DOM.$('div.list-row.account-picker-list'));
		tableTemplate.icon = DOM.append(tableTemplate.root, DOM.$('div.icon'));
		DOM.append(tableTemplate.icon, badge);
		tableTemplate.badgeContent = DOM.append(badge, DOM.$('div.badge-content'));
		tableTemplate.label = DOM.append(tableTemplate.root, DOM.$('div.label'));
		tableTemplate.contextualDisplayName = DOM.append(tableTemplate.label, DOM.$('div.contextual-display-name'));
		tableTemplate.displayName = DOM.append(tableTemplate.label, DOM.$('div.display-name'));
		return tableTemplate;
	}

	public renderElement(account: azdata.Account, index: number, templateData: AccountListTemplate): void {
		// Set the account icon
		templateData.icon.classList.add('account-logo', account.displayInfo.accountType);

		templateData.contextualDisplayName.innerText = account.displayInfo.contextualDisplayName;

		// show the account display name text, something like "User Name (user@email.com)"
		if (account.displayInfo.userId && account.displayInfo.displayName) {
			templateData.displayName.innerText = account.displayInfo.displayName + ' (' + account.displayInfo.userId + ')';
		} else {
			templateData.displayName.innerText = account.displayInfo.displayName;
		}

		if (account.isStale) {
			templateData.badgeContent.className = 'badge-content icon warning-badge';
		} else {
			templateData.badgeContent.className = 'badge-content';
		}
	}

	public disposeTemplate(template: AccountListTemplate): void {
		// noop
	}

	public disposeElement(element: azdata.Account, index: number, templateData: AccountListTemplate): void {
		// noop
	}
}

export class AccountListRenderer extends AccountPickerListRenderer {
	constructor(
		@IInstantiationService private _instantiationService: IInstantiationService
	) {
		super();
	}

	public get templateId(): string {
		return AccountListRenderer.TEMPLATE_ID;
	}

	public renderTemplate(container: HTMLElement): AccountListTemplate {
		const tableTemplate = super.renderTemplate(container);
		tableTemplate.content = DOM.append(tableTemplate.label, DOM.$('div.content'));
		tableTemplate.actions = new ActionBar(tableTemplate.root, { animated: false });

		return tableTemplate;
	}

	public renderElement(account: azdata.Account, index: number, templateData: AccountListTemplate): void {
		super.renderElement(account, index, templateData);
		if (account.isStale) {
			templateData.content.innerText = localize('refreshCredentials', 'You need to refresh the credentials for this account.');
		} else {
			templateData.content.innerText = '';
		}
		templateData.actions.clear();

		const actionOptions: IActionOptions = { icon: true, label: false };
		if (account.isStale) {
			const refreshAction = this._instantiationService.createInstance(RefreshAccountAction);
			refreshAction.account = account;
			templateData.actions.push(refreshAction, actionOptions);
		} else {
			// Todo: Will show filter action when API/GUI for filtering is implemented (#3022, #3024)
			// templateData.actions.push(new ApplyFilterAction(ApplyFilterAction.ID, ApplyFilterAction.LABEL), actionOptions);
		}

		const removeAction = this._instantiationService.createInstance(RemoveAccountAction, account);
		templateData.actions.push(removeAction, actionOptions);
	}
}
