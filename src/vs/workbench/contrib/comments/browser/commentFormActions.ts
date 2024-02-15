/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as DOM from 'vs/base/browser/dom';
import { Button } from 'vs/base/browser/ui/button/button';
import { IAction } from 'vs/base/common/actions';
import { Disposable, dispose } from 'vs/base/common/lifecycle';
import { IMenu } from 'vs/platform/actions/common/actions';
import { attachButtonStyler } from 'vs/platform/theme/common/styler';
import { IThemeService } from 'vs/platform/theme/common/themeService';

export class CommentFormActions extends Disposable {
	private _buttonElements: HTMLElement[] = [];

	constructor(
		private container: HTMLElement,
		private actionHandler: (action: IAction) => void,
		private themeService: IThemeService
	) {
		super();
	}

	setActions(menu: IMenu) {
		dispose(this._toDispose);
		this._buttonElements.forEach(b => DOM.removeNode(b));

		const groups = menu.getActions({ shouldForwardArgs: true });
		for (const group of groups) {
			const [, actions] = group;

			actions.forEach(action => {
				const button = new Button(this.container);
				this._buttonElements.push(button.element);

				this._toDispose.push(button);
				this._toDispose.push(attachButtonStyler(button, this.themeService));
				this._toDispose.push(button.onDidClick(() => this.actionHandler(action)));

				button.enabled = action.enabled;
				button.label = action.label;
			});
		}
	}
}