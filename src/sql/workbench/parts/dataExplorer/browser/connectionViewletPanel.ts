/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import 'vs/css!./media/connectionViewletPanel';
import * as DOM from 'vs/base/browser/dom';
import { dispose, IDisposable } from 'vs/base/common/lifecycle';
import { IExtensionTipsService, IExtensionManagementServerService } from 'vs/platform/extensionManagement/common/extensionManagement';
import { IKeybindingService } from 'vs/platform/keybinding/common/keybinding';
import { IContextMenuService } from 'vs/platform/contextview/browser/contextView';
import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';
import { IThemeService } from 'vs/platform/theme/common/themeService';
import { IViewletViewOptions } from 'vs/workbench/browser/parts/views/viewsViewlet';
import { IConfigurationService } from 'vs/platform/configuration/common/configuration';
import { INotificationService } from 'vs/platform/notification/common/notification';
import { ViewletPanel, IViewletPanelOptions } from 'vs/workbench/browser/parts/views/panelViewlet';
import { IWorkspaceContextService } from 'vs/platform/workspace/common/workspace';
import { IAction } from 'vs/base/common/actions';
import { ServerTreeView } from 'sql/workbench/parts/objectExplorer/browser/serverTreeView';
import {
	ActiveConnectionsFilterAction,
	AddServerAction, AddServerGroupAction
} from 'sql/workbench/parts/objectExplorer/browser/connectionTreeAction';
import { IObjectExplorerService } from 'sql/workbench/services/objectExplorer/common/objectExplorerService';
import { IExtensionsWorkbenchService } from 'vs/workbench/contrib/extensions/common/extensions';

export class ConnectionViewletPanel extends ViewletPanel {

	private _root: HTMLElement;
	private _toDisposeViewlet: IDisposable[] = [];
	private _serverTreeView: ServerTreeView;
	private _addServerAction: IAction;
	private _addServerGroupAction: IAction;
	private _activeConnectionsFilterAction: ActiveConnectionsFilterAction;

	constructor(
		private options: IViewletViewOptions,
		@INotificationService protected notificationService: INotificationService,
		@IKeybindingService keybindingService: IKeybindingService,
		@IContextMenuService contextMenuService: IContextMenuService,
		@IInstantiationService protected instantiationService: IInstantiationService,
		@IThemeService private themeService: IThemeService,
		@IExtensionsWorkbenchService protected extensionsWorkbenchService: IExtensionsWorkbenchService,
		@IExtensionTipsService protected tipsService: IExtensionTipsService,
		@IConfigurationService configurationService: IConfigurationService,
		@IWorkspaceContextService protected contextService: IWorkspaceContextService,
		@IExtensionManagementServerService protected extensionManagementServerService: IExtensionManagementServerService,
		@IObjectExplorerService private objectExplorerService: IObjectExplorerService
	) {
		super({ ...(options as IViewletPanelOptions), ariaHeaderLabel: options.title }, keybindingService, contextMenuService, configurationService);
		this._addServerAction = this.instantiationService.createInstance(AddServerAction,
			AddServerAction.ID,
			AddServerAction.LABEL);
		this._addServerGroupAction = this.instantiationService.createInstance(AddServerGroupAction,
			AddServerGroupAction.ID,
			AddServerGroupAction.LABEL);
		this._serverTreeView = this.objectExplorerService.getServerTreeView();
		if (!this._serverTreeView) {
			this._serverTreeView = this.instantiationService.createInstance(ServerTreeView);
			this.objectExplorerService.registerServerTreeView(this._serverTreeView);
		}
		this._activeConnectionsFilterAction = this._serverTreeView.activeConnectionsFilterAction;
	}

	protected renderHeader(container: HTMLElement): void {
		super.renderHeader(container);
	}

	renderHeaderTitle(container: HTMLElement): void {
		super.renderHeaderTitle(container, this.options.title);
	}

	renderBody(container: HTMLElement): void {
		const viewletContainer = DOM.append(container, DOM.$('div.server-explorer-viewlet'));
		const viewContainer = DOM.append(viewletContainer, DOM.$('div.object-explorer-view'));
		this._serverTreeView.renderBody(viewContainer).then(undefined, error => {
			console.warn('render registered servers: ' + error);
		});
		this._root = container;
	}

	layoutBody(size: number): void {
		this._serverTreeView.layout(size);
		DOM.toggleClass(this._root, 'narrow', this._root.clientWidth < 300);
	}

	show(): void {
	}

	select(): void {
	}

	showPrevious(): void {
	}

	showPreviousPage(): void {
	}

	showNext(): void {
	}

	showNextPage(): void {
	}

	count(): number {
		return 0;
	}

	public getActions(): IAction[] {
		return [
			this._addServerAction,
			this._addServerGroupAction,
			this._activeConnectionsFilterAction
		];
	}

	public clearSearch() {
		this._serverTreeView.refreshTree();
	}

	public search(value: string): void {
		if (value) {
			this._serverTreeView.searchTree(value);
		} else {
			this.clearSearch();
		}
	}

	dispose(): void {
		this.disposables = dispose(this.disposables);
		super.dispose();
	}

	focus(): void {
		super.focus();
		this._serverTreeView.tree.domFocus();
	}
}
