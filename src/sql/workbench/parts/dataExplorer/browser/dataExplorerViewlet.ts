/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { localize } from 'vs/nls';
import { IWorkbenchContribution } from 'vs/workbench/common/contributions';
import { IDisposable, dispose } from 'vs/base/common/lifecycle';
import { IAction } from 'vs/base/common/actions';
import { IViewletService } from 'vs/workbench/services/viewlet/browser/viewlet';
import { append, $, addClass, toggleClass, Dimension } from 'vs/base/browser/dom';
import { ITelemetryService } from 'vs/platform/telemetry/common/telemetry';
import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';
import { IExtensionService } from 'vs/workbench/services/extensions/common/extensions';
import { IThemeService } from 'vs/platform/theme/common/themeService';
import { ViewContainerViewlet, IViewletViewOptions } from 'vs/workbench/browser/parts/views/viewsViewlet';
import { IStorageService } from 'vs/platform/storage/common/storage';
import { IWorkspaceContextService } from 'vs/platform/workspace/common/workspace';
import { IContextMenuService } from 'vs/platform/contextview/browser/contextView';
import { IAddedViewDescriptorRef } from 'vs/workbench/browser/parts/views/views';
import { ViewletPanel } from 'vs/workbench/browser/parts/views/panelViewlet';
import { VIEWLET_ID, VIEW_CONTAINER } from 'sql/workbench/parts/dataExplorer/browser/dataExplorerExtensionPoint';
import { ConnectionViewletPanel } from 'sql/workbench/parts/dataExplorer/browser/connectionViewletPanel';
import { Extensions as ViewContainerExtensions, IViewDescriptor, IViewsRegistry } from 'vs/workbench/common/views';
import { IConfigurationService } from 'vs/platform/configuration/common/configuration';
import { IWorkbenchLayoutService } from 'vs/workbench/services/layout/browser/layoutService';
import { Registry } from 'vs/platform/registry/common/platform';
import { IMenuService, MenuId } from 'vs/platform/actions/common/actions';
import { IContextKeyService } from 'vs/platform/contextkey/common/contextkey';

export class DataExplorerViewletViewsContribution implements IWorkbenchContribution {

	constructor() {
		this.registerViews();
	}

	private registerViews(): void {
		let viewDescriptors = [];
		viewDescriptors.push(this.createObjectExplorerViewDescriptor());
		Registry.as<IViewsRegistry>(ViewContainerExtensions.ViewsRegistry).registerViews(viewDescriptors, VIEW_CONTAINER);
	}

	private createObjectExplorerViewDescriptor(): IViewDescriptor {
		return {
			id: 'dataExplorer.servers',
			name: localize('dataExplorer.servers', "Servers"),
			ctorDescriptor: { ctor: ConnectionViewletPanel },
			weight: 100,
			canToggleVisibility: true,
			order: 0
		};
	}
}

export class DataExplorerViewlet extends ViewContainerViewlet {
	private root: HTMLElement;

	private dataSourcesBox: HTMLElement;
	private disposables: IDisposable[] = [];

	constructor(
		@IWorkbenchLayoutService layoutService: IWorkbenchLayoutService,
		@ITelemetryService telemetryService: ITelemetryService,
		@IInstantiationService instantiationService: IInstantiationService,
		@IViewletService private viewletService: IViewletService,
		@IThemeService themeService: IThemeService,
		@IStorageService storageService: IStorageService,
		@IWorkspaceContextService contextService: IWorkspaceContextService,
		@IContextMenuService contextMenuService: IContextMenuService,
		@IExtensionService extensionService: IExtensionService,
		@IConfigurationService configurationService: IConfigurationService,
		@IMenuService private menuService: IMenuService,
		@IContextKeyService private contextKeyService: IContextKeyService
	) {
		super(VIEWLET_ID, `${VIEWLET_ID}.state`, true, configurationService, layoutService, telemetryService, storageService, instantiationService, themeService, contextMenuService, extensionService, contextService);
	}

	create(parent: HTMLElement): void {
		addClass(parent, 'dataExplorer-viewlet');
		this.root = parent;

		this.dataSourcesBox = append(this.root, $('.dataSources'));

		return super.create(this.dataSourcesBox);
	}

	public updateStyles(): void {
		super.updateStyles();
	}

	focus(): void {
	}

	layout(dimension: Dimension): void {
		toggleClass(this.root, 'narrow', dimension.width <= 300);
		super.layout(new Dimension(dimension.width, dimension.height));
	}

	getOptimalWidth(): number {
		return 400;
	}

	getActions(): IAction[] {
		return [];
	}

	getSecondaryActions(): IAction[] {
		let menu = this.menuService.createMenu(MenuId.DataExplorerAction, this.contextKeyService);
		let actions = [];
		menu.getActions({}).forEach(group => {
			if (group[0] === 'secondary') {
				actions.push(...group[1]);
			}
		});
		return actions;
	}

	protected onDidAddViews(added: IAddedViewDescriptorRef[]): ViewletPanel[] {
		const addedViews = super.onDidAddViews(added);
		return addedViews;
	}

	protected createView(viewDescriptor: IViewDescriptor, options: IViewletViewOptions): ViewletPanel {
		let viewletPanel = this.instantiationService.createInstance(viewDescriptor.ctorDescriptor.ctor, options) as ViewletPanel;
		this._register(viewletPanel);
		return viewletPanel;
	}

	dispose(): void {
		this.disposables = dispose(this.disposables);
		super.dispose();
	}
}
