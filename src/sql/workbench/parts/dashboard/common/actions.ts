/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Action, IAction } from 'vs/base/common/actions';
import * as nls from 'vs/nls';
import { IContextMenuService } from 'vs/platform/contextview/browser/contextView';
import { StandardKeyboardEvent } from 'vs/base/browser/keyboardEvent';
import { IDisposable } from 'vs/base/common/lifecycle';

import { IAngularEventingService, AngularEventType, IAngularEvent } from 'sql/platform/angularEventing/common/angularEventingService';
import { INewDashboardTabDialogService } from 'sql/workbench/services/dashboard/common/newDashboardTabDialog';
import { IDashboardTab } from 'sql/platform/dashboard/common/dashboardRegistry';
import { toDisposableSubscription } from 'sql/base/node/rxjsUtils';

export class EditDashboardAction extends Action {

	private static readonly ID = 'editDashboard';
	private static readonly EDITLABEL = nls.localize('editDashboard', "Edit");
	private static readonly EXITLABEL = nls.localize('editDashboardExit', "Exit");
	private static readonly ICON = 'edit';

	private _state = 0;

	constructor(
		private editFn: () => void,
		private context: any //this
	) {
		super(EditDashboardAction.ID, EditDashboardAction.EDITLABEL, EditDashboardAction.ICON);
	}

	run(): Promise<boolean> {
		try {
			this.editFn.apply(this.context);
			this.toggleLabel();
			return Promise.resolve(true);
		} catch (e) {
			return Promise.resolve(false);
		}
	}

	private toggleLabel(): void {
		if (this._state === 0) {
			this.label = EditDashboardAction.EXITLABEL;
			this._state = 1;
		} else {
			this.label = EditDashboardAction.EDITLABEL;
			this._state = 0;
		}
	}
}

export class RefreshWidgetAction extends Action {

	private static readonly ID = 'refreshWidget';
	private static readonly LABEL = nls.localize('refreshWidget', 'Refresh');
	private static readonly ICON = 'refresh';

	constructor(
		private refreshFn: () => void,
		private context: any // this
	) {
		super(RefreshWidgetAction.ID, RefreshWidgetAction.LABEL, RefreshWidgetAction.ICON);
	}

	run(): Promise<boolean> {
		try {
			this.refreshFn.apply(this.context);
			return Promise.resolve(true);
		} catch (e) {
			return Promise.resolve(false);
		}
	}
}

export class ToggleMoreWidgetAction extends Action {

	private static readonly ID = 'toggleMore';
	private static readonly LABEL = nls.localize('toggleMore', 'Toggle More');
	private static readonly ICON = 'toggle-more';

	constructor(
		private _actions: Array<IAction>,
		private _context: any,
		@IContextMenuService private _contextMenuService: IContextMenuService
	) {
		super(ToggleMoreWidgetAction.ID, ToggleMoreWidgetAction.LABEL, ToggleMoreWidgetAction.ICON);
	}

	run(context: StandardKeyboardEvent): Promise<boolean> {
		this._contextMenuService.showContextMenu({
			getAnchor: () => context.target,
			getActions: () => this._actions,
			getActionsContext: () => this._context
		});
		return Promise.resolve(true);
	}
}

export class DeleteWidgetAction extends Action {
	private static readonly ID = 'deleteWidget';
	private static readonly LABEL = nls.localize('deleteWidget', "Delete Widget");
	private static readonly ICON = 'close';

	constructor(
		private _widgetId,
		private _uri,
		@IAngularEventingService private angularEventService: IAngularEventingService
	) {
		super(DeleteWidgetAction.ID, DeleteWidgetAction.LABEL, DeleteWidgetAction.ICON);
	}

	run(): Promise<boolean> {
		this.angularEventService.sendAngularEvent(this._uri, AngularEventType.DELETE_WIDGET, { id: this._widgetId });
		return Promise.resolve(true);
	}
}

export class PinUnpinTabAction extends Action {
	private static readonly ID = 'pinTab';
	private static readonly PINLABEL = nls.localize('clickToUnpin', "Click to unpin");
	private static readonly UNPINLABEL = nls.localize('clickToPin', "Click to pin");
	private static readonly PINICON = 'pin';
	private static readonly UNPINICON = 'unpin';

	constructor(
		private _tabId: string,
		private _uri: string,
		private _isPinned: boolean,
		@IAngularEventingService private angularEventService: IAngularEventingService
	) {
		super(PinUnpinTabAction.ID, PinUnpinTabAction.PINLABEL, PinUnpinTabAction.PINICON);
		this.updatePinStatus();
	}

	private updatePinStatus() {
		if (this._isPinned) {
			this.label = PinUnpinTabAction.PINLABEL;
			this.class = PinUnpinTabAction.PINICON;
		} else {
			this.label = PinUnpinTabAction.UNPINLABEL;
			this.class = PinUnpinTabAction.UNPINICON;
		}
	}

	public run(): Promise<boolean> {
		this._isPinned = !this._isPinned;
		this.updatePinStatus();
		this.angularEventService.sendAngularEvent(this._uri, AngularEventType.PINUNPIN_TAB, { tabId: this._tabId, isPinned: this._isPinned });
		return Promise.resolve(true);
	}
}

export class AddFeatureTabAction extends Action {
	private static readonly ID = 'openInstalledFeatures';
	private static readonly LABEL = nls.localize('addFeatureAction.openInstalledFeatures', "Open installed features");
	private static readonly ICON = 'new';

	private _disposables: IDisposable[] = [];

	constructor(
		private _dashboardTabs: Array<IDashboardTab>,
		private _openedTabs: Array<IDashboardTab>,
		private _uri: string,
		@INewDashboardTabDialogService private _newDashboardTabService: INewDashboardTabDialogService,
		@IAngularEventingService private _angularEventService: IAngularEventingService
	) {
		super(AddFeatureTabAction.ID, AddFeatureTabAction.LABEL, AddFeatureTabAction.ICON);
		this._disposables.push(toDisposableSubscription(this._angularEventService.onAngularEvent(this._uri, (event) => this.handleDashboardEvent(event))));
	}

	run(): Promise<boolean> {
		this._newDashboardTabService.showDialog(this._dashboardTabs, this._openedTabs, this._uri);
		return Promise.resolve(true);
	}

	dispose() {
		super.dispose();
		this._disposables.forEach((item) => item.dispose());
	}

	private handleDashboardEvent(event: IAngularEvent): void {
		switch (event.event) {
			case AngularEventType.NEW_TABS:
				const openedTabs = <IDashboardTab[]>event.payload.dashboardTabs;
				openedTabs.forEach(tab => {
					const existedTab = this._openedTabs.find(i => i === tab);
					if (!existedTab) {
						this._openedTabs.push(tab);
					}
				});
				break;
			case AngularEventType.CLOSE_TAB:
				const index = this._openedTabs.findIndex(i => i.id === event.payload.id);
				this._openedTabs.splice(index, 1);
				break;
		}
	}
}

export class CollapseWidgetAction extends Action {
	private static readonly ID = 'collapseWidget';
	private static readonly COLLPASE_LABEL = nls.localize('collapseWidget', "Collapse");
	private static readonly EXPAND_LABEL = nls.localize('expandWidget', "Expand");
	private static readonly COLLAPSE_ICON = 'maximize-panel-action';
	private static readonly EXPAND_ICON = 'minimize-panel-action';

	constructor(
		private _uri: string,
		private _widgetUuid: string,
		private collpasedState: boolean,
		@IAngularEventingService private _angularEventService: IAngularEventingService
	) {
		super(
			CollapseWidgetAction.ID,
			collpasedState ? CollapseWidgetAction.EXPAND_LABEL : CollapseWidgetAction.COLLPASE_LABEL,
			collpasedState ? CollapseWidgetAction.EXPAND_ICON : CollapseWidgetAction.COLLAPSE_ICON
		);
	}

	run(): Promise<boolean> {
		this._toggleState();
		this._angularEventService.sendAngularEvent(this._uri, AngularEventType.COLLAPSE_WIDGET, this._widgetUuid);
		return Promise.resolve(true);
	}

	private _toggleState(): void {
		this._updateState(!this.collpasedState);
	}

	private _updateState(collapsed: boolean): void {
		if (collapsed === this.collpasedState) {
			return;
		}
		this.collpasedState = collapsed;
		this._setClass(this.collpasedState ? CollapseWidgetAction.EXPAND_ICON : CollapseWidgetAction.COLLAPSE_ICON);
		this._setLabel(this.collpasedState ? CollapseWidgetAction.EXPAND_LABEL : CollapseWidgetAction.COLLPASE_LABEL);
	}

	public set state(collapsed: boolean) {
		this._updateState(collapsed);
	}
}
