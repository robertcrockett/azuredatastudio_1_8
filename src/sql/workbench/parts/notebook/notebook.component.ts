/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { OnInit, Component, Inject, forwardRef, ElementRef, ChangeDetectorRef, ViewChild, OnDestroy } from '@angular/core';

import { IColorTheme, IWorkbenchThemeService } from 'vs/workbench/services/themes/common/workbenchThemeService';
import * as themeColors from 'vs/workbench/common/theme';
import { INotificationService, INotification, Severity } from 'vs/platform/notification/common/notification';
import { localize } from 'vs/nls';
import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';
import { IContextMenuService, IContextViewService } from 'vs/platform/contextview/browser/contextView';
import { IEditorService } from 'vs/workbench/services/editor/common/editorService';
import { attachSelectBoxStyler } from 'vs/platform/theme/common/styler';
import { MenuId, IMenuService, MenuItemAction } from 'vs/platform/actions/common/actions';
import { IAction, Action, IActionViewItem } from 'vs/base/common/actions';
import { IContextKeyService, RawContextKey } from 'vs/platform/contextkey/common/contextkey';
import { IKeybindingService } from 'vs/platform/keybinding/common/keybinding';
import { IViewletService } from 'vs/workbench/services/viewlet/browser/viewlet';

import { AngularDisposable } from 'sql/base/node/lifecycle';
import { CellTypes, CellType } from 'sql/workbench/parts/notebook/models/contracts';
import { ICellModel, IModelFactory, INotebookModel, NotebookContentChange } from 'sql/workbench/parts/notebook/models/modelInterfaces';
import { IConnectionManagementService } from 'sql/platform/connection/common/connectionManagement';
import { INotebookService, INotebookParams, INotebookManager, INotebookEditor, DEFAULT_NOTEBOOK_PROVIDER, SQL_NOTEBOOK_PROVIDER } from 'sql/workbench/services/notebook/common/notebookService';
import { IBootstrapParams } from 'sql/platform/bootstrap/node/bootstrapService';
import { NotebookModel } from 'sql/workbench/parts/notebook/models/notebookModel';
import { ModelFactory } from 'sql/workbench/parts/notebook/models/modelFactory';
import * as notebookUtils from 'sql/workbench/parts/notebook/notebookUtils';
import { Deferred } from 'sql/base/common/promise';
import { IConnectionProfile } from 'sql/platform/connection/common/interfaces';
import { Taskbar } from 'sql/base/browser/ui/taskbar/taskbar';
import { KernelsDropdown, AttachToDropdown, AddCellAction, TrustedAction, RunAllCellsAction, ClearAllOutputsAction } from 'sql/workbench/parts/notebook/notebookActions';
import { IObjectExplorerService } from 'sql/workbench/services/objectExplorer/common/objectExplorerService';
import * as TaskUtilities from 'sql/workbench/common/taskUtilities';
import { ISingleNotebookEditOperation } from 'sql/workbench/api/common/sqlExtHostTypes';
import { IConnectionDialogService } from 'sql/workbench/services/connection/common/connectionDialogService';
import { ICapabilitiesService } from 'sql/platform/capabilities/common/capabilitiesService';
import { CellMagicMapper } from 'sql/workbench/parts/notebook/models/cellMagicMapper';
import { IExtensionsViewlet, VIEWLET_ID } from 'vs/workbench/contrib/extensions/common/extensions';
import { CellModel } from 'sql/workbench/parts/notebook/models/cell';
import { FileOperationError, FileOperationResult } from 'vs/platform/files/common/files';
import { isValidBasename } from 'vs/base/common/extpath';
import { basename } from 'vs/base/common/resources';
import { createErrorWithActions } from 'vs/base/common/errorsWithActions';
import { toErrorMessage } from 'vs/base/common/errorMessage';
import { ILogService } from 'vs/platform/log/common/log';
import { ITextFileService } from 'vs/workbench/services/textfile/common/textfiles';
import { LabeledMenuItemActionItem, fillInActions } from 'vs/platform/actions/browser/menuEntryActionViewItem';


export const NOTEBOOK_SELECTOR: string = 'notebook-component';


@Component({
	selector: NOTEBOOK_SELECTOR,
	templateUrl: decodeURI(require.toUrl('./notebook.component.html'))
})
export class NotebookComponent extends AngularDisposable implements OnInit, OnDestroy, INotebookEditor {
	@ViewChild('toolbar', { read: ElementRef }) private toolbar: ElementRef;
	@ViewChild('container', { read: ElementRef }) private container: ElementRef;
	private _model: NotebookModel;
	private _isInErrorState: boolean = false;
	private _errorMessage: string;
	protected _actionBar: Taskbar;
	protected isLoading: boolean;
	private notebookManagers: INotebookManager[] = [];
	private _modelReadyDeferred = new Deferred<NotebookModel>();
	private _modelRegisteredDeferred = new Deferred<NotebookModel>();
	private profile: IConnectionProfile;
	private _trustedAction: TrustedAction;
	private _runAllCellsAction: RunAllCellsAction;
	private _providerRelatedActions: IAction[] = [];
	private _scrollTop: number;


	constructor(
		@Inject(forwardRef(() => ChangeDetectorRef)) private _changeRef: ChangeDetectorRef,
		@Inject(IWorkbenchThemeService) private themeService: IWorkbenchThemeService,
		@Inject(IConnectionManagementService) private connectionManagementService: IConnectionManagementService,
		@Inject(IObjectExplorerService) private objectExplorerService: IObjectExplorerService,
		@Inject(IEditorService) private editorService: IEditorService,
		@Inject(INotificationService) private notificationService: INotificationService,
		@Inject(INotebookService) private notebookService: INotebookService,
		@Inject(IBootstrapParams) private _notebookParams: INotebookParams,
		@Inject(IInstantiationService) private instantiationService: IInstantiationService,
		@Inject(IContextMenuService) private contextMenuService: IContextMenuService,
		@Inject(IContextViewService) private contextViewService: IContextViewService,
		@Inject(IConnectionDialogService) private connectionDialogService: IConnectionDialogService,
		@Inject(IContextKeyService) private contextKeyService: IContextKeyService,
		@Inject(IMenuService) private menuService: IMenuService,
		@Inject(IKeybindingService) private keybindingService: IKeybindingService,
		@Inject(IViewletService) private viewletService: IViewletService,
		@Inject(ICapabilitiesService) private capabilitiesService: ICapabilitiesService,
		@Inject(ITextFileService) private textFileService: ITextFileService,
		@Inject(ILogService) private readonly logService: ILogService
	) {
		super();
		this.updateProfile();
		this.isLoading = true;
	}

	private updateProfile(): void {
		this.profile = this.notebookParams ? this.notebookParams.profile : undefined;
		if (!this.profile) {
			// Second use global connection if possible
			let profile: IConnectionProfile = TaskUtilities.getCurrentGlobalConnection(this.objectExplorerService, this.connectionManagementService, this.editorService);

			// TODO use generic method to match kernel with valid connection that's compatible. For now, we only have 1
			if (profile && profile.providerName) {
				this.profile = profile;
			} else {
				// if not, try 1st active connection that matches our filter
				let activeProfiles = this.connectionManagementService.getActiveConnections();
				if (activeProfiles && activeProfiles.length > 0) {
					this.profile = activeProfiles[0];
				}
			}
		}
	}

	ngOnInit() {
		this._register(this.themeService.onDidColorThemeChange(this.updateTheme, this));
		this.updateTheme(this.themeService.getColorTheme());
		this.initActionBar();
		this.setScrollPosition();
		this.doLoad();
	}

	ngOnDestroy() {
		this.dispose();
		if (this.notebookService) {
			this.notebookService.removeNotebookEditor(this);
		}
	}

	public get model(): NotebookModel | null {
		return this._model;
	}

	public get activeCellId(): string {
		return this._model && this._model.activeCell ? this._model.activeCell.id : '';
	}

	public get modelRegistered(): Promise<NotebookModel> {
		return this._modelRegisteredDeferred.promise;
	}

	public get cells(): ICellModel[] {
		return this._model ? this._model.cells : [];
	}

	private updateTheme(theme: IColorTheme): void {
		let toolbarEl = <HTMLElement>this.toolbar.nativeElement;
		toolbarEl.style.borderBottomColor = theme.getColor(themeColors.SIDE_BAR_BACKGROUND, true).toString();
	}

	public selectCell(cell: ICellModel, event?: Event) {
		if (event) {
			event.stopPropagation();
		}
		if (cell !== this.model.activeCell) {
			if (this.model.activeCell) {
				this.model.activeCell.active = false;
			}
			this._model.activeCell = cell;
			this._model.activeCell.active = true;
			this.detectChanges();
		}
	}

	//Saves scrollTop value on scroll change
	public scrollHandler(event: Event) {
		this._scrollTop = (<HTMLElement>event.srcElement).scrollTop;
	}

	public unselectActiveCell() {
		if (this.model && this.model.activeCell) {
			this.model.activeCell.active = false;
			this.model.activeCell = undefined;
		}
		this.detectChanges();
	}

	// Add cell based on cell type
	public addCell(cellType: CellType) {
		this._model.addCell(cellType);
	}

	public onKeyDown(event) {
		switch (event.key) {
			case 'ArrowDown':
			case 'ArrowRight':
				let nextIndex = (this.findCellIndex(this.model.activeCell) + 1) % this.cells.length;
				this.selectCell(this.cells[nextIndex]);
				break;
			case 'ArrowUp':
			case 'ArrowLeft':
				let index = this.findCellIndex(this.model.activeCell);
				if (index === 0) {
					index = this.cells.length;
				}
				this.selectCell(this.cells[--index]);
				break;
			default:
				break;
		}
	}

	private setScrollPosition(): void {
		if (this._notebookParams && this._notebookParams.input) {
			this._notebookParams.input.layoutChanged(() => {
				let containerElement = <HTMLElement>this.container.nativeElement;
				containerElement.scrollTop = this._scrollTop;
			});
		}
	}

	private async doLoad(): Promise<void> {
		try {
			await this.setNotebookManager();
			await this.loadModel();
			this._modelReadyDeferred.resolve(this._model);
			this.notebookService.addNotebookEditor(this);
		} catch (error) {
			if (error) {
				// Offer to create a file from the error if we have a file not found and the name is valid
				if ((<FileOperationError>error).fileOperationResult === FileOperationResult.FILE_NOT_FOUND && isValidBasename(basename(this.notebookParams.notebookUri))) {
					let errorWithAction = createErrorWithActions(toErrorMessage(error), {
						actions: [
							new Action('workbench.files.action.createMissingFile', localize('createFile', "Create File"), undefined, true, () => {
								return this.textFileService.create(this.notebookParams.notebookUri).then(() => this.editorService.openEditor({
									resource: this.notebookParams.notebookUri,
									options: {
										pinned: true // new file gets pinned by default
									}
								}));
							})
						]
					});
					this.notificationService.error(errorWithAction);

					let editors = this.editorService.visibleControls;
					for (let editor of editors) {
						if (editor && editor.input.getResource() === this._notebookParams.input.notebookUri) {
							await editor.group.closeEditor(this._notebookParams.input, { preserveFocus: true });
							break;
						}
					}
				} else {
					this.setViewInErrorState(localize('displayFailed', 'Could not display contents: {0}', notebookUtils.getErrorMessage(error)));
					this.setLoading(false);
					this._modelReadyDeferred.reject(error);

					this.notebookService.addNotebookEditor(this);
				}
			}
		}
	}

	private setLoading(isLoading: boolean): void {
		this.isLoading = isLoading;
		this.detectChanges();
	}

	private async loadModel(): Promise<void> {
		await this.awaitNonDefaultProvider();
		let model = new NotebookModel({
			factory: this.modelFactory,
			notebookUri: this._notebookParams.notebookUri,
			connectionService: this.connectionManagementService,
			notificationService: this.notificationService,
			notebookManagers: this.notebookManagers,
			contentManager: this._notebookParams.input.contentManager,
			standardKernels: this._notebookParams.input.standardKernels,
			cellMagicMapper: new CellMagicMapper(this.notebookService.languageMagics),
			providerId: 'sql', // this is tricky; really should also depend on the connection profile
			defaultKernel: this._notebookParams.input.defaultKernel,
			layoutChanged: this._notebookParams.input.layoutChanged,
			capabilitiesService: this.capabilitiesService
		}, this.profile, this.logService, this.notificationService);
		model.onError((errInfo: INotification) => this.handleModelError(errInfo));
		let trusted = await this.notebookService.isNotebookTrustCached(this._notebookParams.notebookUri, this.isDirty());
		await model.requestModelLoad(trusted);
		model.contentChanged((change) => this.handleContentChanged(change));
		model.onProviderIdChange((provider) => this.handleProviderIdChanged(provider));
		this._model = this._register(model);
		this.updateToolbarComponents(this._model.trustedMode);
		this._modelRegisteredDeferred.resolve(this._model);
		this.setLoading(false);
		await model.startSession(this.model.notebookManager, undefined, true);
		this.setContextKeyServiceWithProviderId(model.providerId);
		this.fillInActionsForCurrentContext();
		this.detectChanges();
	}

	private async setNotebookManager(): Promise<void> {
		let providerInfo = await this._notebookParams.providerInfo;
		for (let providerId of providerInfo.providers) {
			let notebookManager = await this.notebookService.getOrCreateNotebookManager(providerId, this._notebookParams.notebookUri);
			this.notebookManagers.push(notebookManager);
		}
	}

	private async awaitNonDefaultProvider(): Promise<void> {
		// Wait on registration for now. Long-term would be good to cache and refresh
		await this.notebookService.registrationComplete;
		// Refresh the provider if we had been using default
		let providerInfo = await this._notebookParams.providerInfo;

		if (DEFAULT_NOTEBOOK_PROVIDER === providerInfo.providerId) {
			let providers = notebookUtils.getProvidersForFileName(this._notebookParams.notebookUri.fsPath, this.notebookService);
			let tsqlProvider = providers.find(provider => provider === SQL_NOTEBOOK_PROVIDER);
			providerInfo.providerId = tsqlProvider ? SQL_NOTEBOOK_PROVIDER : providers[0];
		}
		if (DEFAULT_NOTEBOOK_PROVIDER === providerInfo.providerId) {
			// If it's still the default, warn them they should install an extension
			this.notificationService.prompt(Severity.Warning,
				localize('noKernelInstalled', 'Please install the SQL Server 2019 extension to run cells'),
				[{
					label: localize('installSql2019Extension', 'Install Extension'),
					run: () => this.openExtensionGallery()
				}]);
		}
	}

	private async openExtensionGallery(): Promise<void> {
		try {
			let viewlet = await this.viewletService.openViewlet(VIEWLET_ID, true) as IExtensionsViewlet;
			viewlet.search('sql-vnext');
			viewlet.focus();
		} catch (error) {
			this.notificationService.error(error.message);
		}
	}

	// Updates toolbar components
	private updateToolbarComponents(isTrusted: boolean) {
		if (this._trustedAction) {
			this._trustedAction.enabled = true;
			this._trustedAction.trusted = isTrusted;
		}
	}

	private get modelFactory(): IModelFactory {
		if (!this._notebookParams.modelFactory) {
			this._notebookParams.modelFactory = new ModelFactory();
		}
		return this._notebookParams.modelFactory;
	}

	private handleModelError(notification: INotification): void {
		this.notificationService.notify(notification);
	}

	private handleContentChanged(change: NotebookContentChange) {
		// Note: for now we just need to set dirty state and refresh the UI.
		this.detectChanges();
	}

	private handleProviderIdChanged(providerId: string) {
		// If there are any actions that were related to the previous provider,
		// disable them in the actionBar
		this._providerRelatedActions.forEach(action => {
			action.enabled = false;
		});
		this.setContextKeyServiceWithProviderId(providerId);
		this.fillInActionsForCurrentContext();
	}

	findCellIndex(cellModel: ICellModel): number {
		return this._model.cells.findIndex((cell) => cell.id === cellModel.id);
	}

	private setViewInErrorState(error: any): any {
		this._isInErrorState = true;
		this._errorMessage = notebookUtils.getErrorMessage(error);
		// For now, send message as error notification #870 covers having dedicated area for this
		this.notificationService.error(error);
	}

	protected initActionBar() {
		let kernelContainer = document.createElement('div');
		let kernelDropdown = new KernelsDropdown(kernelContainer, this.contextViewService, this.modelReady);
		kernelDropdown.render(kernelContainer);
		attachSelectBoxStyler(kernelDropdown, this.themeService);

		let attachToContainer = document.createElement('div');
		let attachToDropdown = new AttachToDropdown(attachToContainer, this.contextViewService, this.modelReady,
			this.connectionManagementService, this.connectionDialogService, this.notificationService, this.capabilitiesService, this.logService);
		attachToDropdown.render(attachToContainer);
		attachSelectBoxStyler(attachToDropdown, this.themeService);

		let addCodeCellButton = new AddCellAction('notebook.AddCodeCell', localize('code', 'Code'), 'notebook-button icon-add');
		addCodeCellButton.cellType = CellTypes.Code;

		let addTextCellButton = new AddCellAction('notebook.AddTextCell', localize('text', 'Text'), 'notebook-button icon-add');
		addTextCellButton.cellType = CellTypes.Markdown;

		this._runAllCellsAction = new RunAllCellsAction('notebook.runAllCells', localize('runAll', 'Run Cells'), 'notebook-button icon-run-cells');
		let clearResultsButton = new ClearAllOutputsAction('notebook.ClearAllOutputs', localize('clearResults', 'Clear Results'), 'notebook-button icon-clear-results');

		this._trustedAction = this.instantiationService.createInstance(TrustedAction, 'notebook.Trusted');
		this._trustedAction.enabled = false;

		let taskbar = <HTMLElement>this.toolbar.nativeElement;
		this._actionBar = new Taskbar(taskbar, { actionViewItemProvider: action => this.actionItemProvider(action as Action) });
		this._actionBar.context = this;
		this._actionBar.setContent([
			{ action: addCodeCellButton },
			{ action: addTextCellButton },
			{ element: kernelContainer },
			{ element: attachToContainer },
			{ action: this._trustedAction },
			{ action: this._runAllCellsAction },
			{ action: clearResultsButton }
		]);

	}

	private actionItemProvider(action: Action): IActionViewItem {
		// Check extensions to create ActionItem; otherwise, return undefined
		// This is similar behavior that exists in MenuItemActionItem
		if (action instanceof MenuItemAction) {
			return new LabeledMenuItemActionItem(action, this.keybindingService, this.notificationService, this.contextMenuService, 'notebook-button');
		}
		return undefined;
	}

	/**
	 * Get all of the menu contributions that use the ID 'notebook/toolbar'.
	 * Then, find all groups (currently we don't leverage the contributed
	 * groups functionality for the notebook toolbar), and fill in the 'primary'
	 * array with items that don't list a group. Finally, add any actions from
	 * the primary array to the end of the toolbar.
	 */
	private fillInActionsForCurrentContext(): void {
		let primary: IAction[] = [];
		let secondary: IAction[] = [];
		let notebookBarMenu = this.menuService.createMenu(MenuId.NotebookToolbar, this.contextKeyService);
		let groups = notebookBarMenu.getActions({ arg: null, shouldForwardArgs: true });
		fillInActions(groups, { primary, secondary }, false, (group: string) => group === undefined || group === '');
		this.addPrimaryContributedActions(primary);
	}

	private detectChanges(): void {
		if (!(this._changeRef['destroyed'])) {
			this._changeRef.detectChanges();
		}
	}

	private addPrimaryContributedActions(primary: IAction[]) {
		for (let action of primary) {
			// Need to ensure that we don't add the same action multiple times
			let foundIndex = this._providerRelatedActions.findIndex(act => act.id === action.id);
			if (foundIndex < 0) {
				this._actionBar.addAction(action);
				this._providerRelatedActions.push(action);
			} else {
				this._providerRelatedActions[foundIndex].enabled = true;
			}
		}
	}

	private setContextKeyServiceWithProviderId(providerId: string) {
		let provider = new RawContextKey<string>('providerId', providerId);
		provider.bindTo(this.contextKeyService);
	}

	public get notebookParams(): INotebookParams {
		return this._notebookParams;
	}

	public get id(): string {
		return this._notebookParams.notebookUri.toString();
	}

	public get modelReady(): Promise<INotebookModel> {
		return this._modelReadyDeferred.promise;
	}

	isActive(): boolean {
		return this.editorService.activeEditor === this.notebookParams.input;
	}

	isVisible(): boolean {
		let notebookEditor = this.notebookParams.input;
		return this.editorService.visibleEditors.some(e => e === notebookEditor);
	}

	isDirty(): boolean {
		return this.notebookParams.input.isDirty();
	}

	executeEdits(edits: ISingleNotebookEditOperation[]): boolean {
		if (!edits || edits.length === 0) {
			return false;
		}
		this._model.pushEditOperations(edits);
		return true;
	}

	public async runCell(cell: ICellModel): Promise<boolean> {
		await this.modelReady;
		let uriString = cell.cellUri.toString();
		if (this._model.cells.findIndex(c => c.cellUri.toString() === uriString) > -1) {
			this.selectCell(cell);
			return cell.runCell(this.notificationService, this.connectionManagementService);
		} else {
			return Promise.reject(new Error(localize('cellNotFound', 'cell with URI {0} was not found in this model', uriString)));
		}
	}

	public async runAllCells(): Promise<boolean> {
		await this.modelReady;
		let codeCells = this._model.cells.filter(cell => cell.cellType === CellTypes.Code);
		if (codeCells && codeCells.length) {
			for (let i = 0; i < codeCells.length; i++) {
				let cellStatus = await this.runCell(codeCells[i]);
				if (!cellStatus) {
					return Promise.reject(new Error(localize('cellRunFailed', 'running cell id {0} failed', codeCells[i].id)));
				}
			}
		}
		return true;
	}

	public async clearAllOutputs(): Promise<boolean> {
		try {
			await this.modelReady;
			this._model.cells.forEach(cell => {
				if (cell.cellType === CellTypes.Code) {
					(cell as CellModel).clearOutputs();
				}
			});
			return Promise.resolve(true);
		}
		catch (e) {
			return Promise.reject(e);
		}
	}

}
