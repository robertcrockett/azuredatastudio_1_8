/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import 'vs/css!./code';

import { OnInit, Component, Input, Inject, ElementRef, ViewChild, Output, EventEmitter, OnChanges, SimpleChange, forwardRef, ChangeDetectorRef } from '@angular/core';

import { AngularDisposable } from 'sql/base/node/lifecycle';
import { QueryTextEditor } from 'sql/workbench/electron-browser/modelComponents/queryTextEditor';
import { CellToggleMoreActions } from 'sql/workbench/parts/notebook/cellToggleMoreActions';
import { ICellModel, notebookConstants, CellExecutionState } from 'sql/workbench/parts/notebook/models/modelInterfaces';
import { Taskbar } from 'sql/base/browser/ui/taskbar/taskbar';
import { RunCellAction, CellContext } from 'sql/workbench/parts/notebook/cellViews/codeActions';
import { NotebookModel } from 'sql/workbench/parts/notebook/models/notebookModel';

import { IColorTheme, IWorkbenchThemeService } from 'vs/workbench/services/themes/common/workbenchThemeService';
import * as themeColors from 'vs/workbench/common/theme';
import { ServiceCollection } from 'vs/platform/instantiation/common/serviceCollection';
import { SimpleProgressService } from 'vs/editor/standalone/browser/simpleServices';
import { IProgressService } from 'vs/platform/progress/common/progress';
import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';
import { ITextModel } from 'vs/editor/common/model';
import { UntitledEditorInput } from 'vs/workbench/common/editor/untitledEditorInput';
import * as DOM from 'vs/base/browser/dom';
import { IModeService } from 'vs/editor/common/services/modeService';
import { IModelService } from 'vs/editor/common/services/modelService';
import { IConfigurationService } from 'vs/platform/configuration/common/configuration';
import { Event, Emitter } from 'vs/base/common/event';
import { CellTypes } from 'sql/workbench/parts/notebook/models/contracts';
import { OVERRIDE_EDITOR_THEMING_SETTING } from 'sql/workbench/services/notebook/common/notebookService';
import * as notebookUtils from 'sql/workbench/parts/notebook/notebookUtils';
import { UntitledEditorModel } from 'vs/workbench/common/editor/untitledEditorModel';
import { IConnectionManagementService } from 'sql/platform/connection/common/connectionManagement';
import { ILogService } from 'vs/platform/log/common/log';

export const CODE_SELECTOR: string = 'code-component';
const MARKDOWN_CLASS = 'markdown';

@Component({
	selector: CODE_SELECTOR,
	templateUrl: decodeURI(require.toUrl('./code.component.html'))
})
export class CodeComponent extends AngularDisposable implements OnInit, OnChanges {
	@ViewChild('toolbar', { read: ElementRef }) private toolbarElement: ElementRef;
	@ViewChild('moreactions', { read: ElementRef }) private moreActionsElementRef: ElementRef;
	@ViewChild('editor', { read: ElementRef }) private codeElement: ElementRef;

	public get cellModel(): ICellModel {
		return this._cellModel;
	}

	@Input() public set cellModel(value: ICellModel) {
		this._cellModel = value;
		if (this.toolbarElement && value && value.cellType === CellTypes.Markdown) {
			let nativeToolbar = <HTMLElement>this.toolbarElement.nativeElement;
			DOM.addClass(nativeToolbar, MARKDOWN_CLASS);
		}
	}

	@Output() public onContentChanged = new EventEmitter<void>();

	@Input() set model(value: NotebookModel) {
		this._model = value;
		this._register(value.kernelChanged(() => {
			// On kernel change, need to reevaluate the language for each cell
			// Refresh based on the cell magic (since this is kernel-dependent) and then update using notebook language
			this.checkForLanguageMagics();
			this.updateLanguageMode();
		}));
		this._register(value.onValidConnectionSelected(() => {
			this.updateConnectionState(this.isActive());
		}));
	}

	@Input() set activeCellId(value: string) {
		this._activeCellId = value;
	}

	@Input() set hover(value: boolean) {
		this.cellModel.hover = value;
		if (!this.isActive()) {
			// Only make a change if we're not active, since this has priority
			this.toggleMoreActionsButton(this.cellModel.hover);
		}
	}

	protected _actionBar: Taskbar;
	private readonly _minimumHeight = 30;
	private readonly _maximumHeight = 4000;
	private _cellModel: ICellModel;
	private _editor: QueryTextEditor;
	private _editorInput: UntitledEditorInput;
	private _editorModel: ITextModel;
	private _model: NotebookModel;
	private _activeCellId: string;
	private _cellToggleMoreActions: CellToggleMoreActions;
	private _layoutEmitter = new Emitter<void>();

	constructor(
		@Inject(IWorkbenchThemeService) private themeService: IWorkbenchThemeService,
		@Inject(IInstantiationService) private _instantiationService: IInstantiationService,
		@Inject(IModelService) private _modelService: IModelService,
		@Inject(IModeService) private _modeService: IModeService,
		@Inject(IConfigurationService) private _configurationService: IConfigurationService,
		@Inject(forwardRef(() => ChangeDetectorRef)) private _changeRef: ChangeDetectorRef,
		@Inject(ILogService) private readonly logService: ILogService
	) {
		super();
		this._cellToggleMoreActions = this._instantiationService.createInstance(CellToggleMoreActions);
		this._register(Event.debounce(this._layoutEmitter.event, (l, e) => e, 250, /*leading=*/false)
			(() => this.layout()));
		// Handle disconnect on removal of the cell, if it was the active cell
		this._register({ dispose: () => this.updateConnectionState(false) });

	}

	ngOnInit() {
		this._register(this.themeService.onDidColorThemeChange(this.updateTheme, this));
		this.updateTheme(this.themeService.getColorTheme());
		this.initActionBar();
	}

	ngOnChanges(changes: { [propKey: string]: SimpleChange }) {
		this.updateLanguageMode();
		this.updateModel();
		for (let propName in changes) {
			if (propName === 'activeCellId') {
				let changedProp = changes[propName];
				let isActive = this.cellModel.id === changedProp.currentValue;
				this.updateConnectionState(isActive);
				this.toggleMoreActionsButton(isActive);
				if (this._editor) {
					this._editor.toggleEditorSelected(isActive);
				}
				break;
			}
		}
	}

	private updateConnectionState(shouldConnect: boolean) {
		if (this.isSqlCodeCell()) {
			let cellUri = this.cellModel.cellUri.toString();
			let connectionService = this.connectionService;
			if (!shouldConnect && connectionService && connectionService.isConnected(cellUri)) {
				connectionService.disconnect(cellUri).catch(e => this.logService.error(e));
			} else if (shouldConnect && this._model.activeConnection && this._model.activeConnection.id !== '-1') {
				connectionService.connect(this._model.activeConnection, cellUri).catch(e => this.logService.error(e));
			}
		}
	}

	private get connectionService(): IConnectionManagementService {
		return this._model && this._model.notebookOptions && this._model.notebookOptions.connectionService;
	}

	private isSqlCodeCell() {
		return this._model
			&& this._model.defaultKernel
			&& this._model.defaultKernel.display_name === notebookConstants.SQL
			&& this.cellModel.cellType === CellTypes.Code
			&& this.cellModel.cellUri;
	}

	private get destroyed(): boolean {
		return !!(this._changeRef['destroyed']);
	}

	ngAfterContentInit(): void {
		if (this.destroyed) {
			return;
		}
		this.createEditor();
		this._register(DOM.addDisposableListener(window, DOM.EventType.RESIZE, e => {
			this._layoutEmitter.fire();
		}));
	}

	ngAfterViewInit(): void {
		this._layoutEmitter.fire();
	}

	get model(): NotebookModel {
		return this._model;
	}

	get activeCellId(): string {
		return this._activeCellId;
	}

	private async createEditor(): Promise<void> {
		let instantiationService = this._instantiationService.createChild(new ServiceCollection([IProgressService, new SimpleProgressService()]));
		this._editor = instantiationService.createInstance(QueryTextEditor);
		this._editor.create(this.codeElement.nativeElement);
		this._editor.setVisible(true);
		this._editor.setMinimumHeight(this._minimumHeight);
		this._editor.setMaximumHeight(this._maximumHeight);
		let uri = this.cellModel.cellUri;
		this._editorInput = instantiationService.createInstance(UntitledEditorInput, uri, false, this.cellModel.language, this.cellModel.source, '');
		await this._editor.setInput(this._editorInput, undefined);
		this.setFocusAndScroll();
		let untitledEditorModel: UntitledEditorModel = await this._editorInput.resolve();
		this._editorModel = untitledEditorModel.textEditorModel;
		let isActive = this.cellModel.id === this._activeCellId;
		this._editor.toggleEditorSelected(isActive);
		// For markdown cells, don't show line numbers unless we're using editor defaults
		let overrideEditorSetting = this._configurationService.getValue<boolean>(OVERRIDE_EDITOR_THEMING_SETTING);
		this._editor.hideLineNumbers = (overrideEditorSetting && this.cellModel.cellType === CellTypes.Markdown);


		if (this.destroyed) {
			// At this point, we may have been disposed (scenario: restoring markdown cell in preview mode).
			// Exiting early to avoid warnings on registering already disposed items, which causes some churning
			// due to re-disposing things.
			// There's no negative impact as at this point the component isn't visible (it was removed from the DOM)
			return;
		}
		this._register(this._editor);
		this._register(this._editorInput);
		this._register(this._editorModel.onDidChangeContent(e => {
			this._editor.setHeightToScrollHeight();
			this.cellModel.source = this._editorModel.getValue();
			this.onContentChanged.emit();
			this.checkForLanguageMagics();
			// TODO see if there's a better way to handle reassessing size.
			setTimeout(() => this._layoutEmitter.fire(), 250);
		}));
		this._register(this._configurationService.onDidChangeConfiguration(e => {
			if (e.affectsConfiguration('editor.wordWrap')) {
				this._editor.setHeightToScrollHeight(true);
			}
		}));
		this._register(this.model.layoutChanged(() => this._layoutEmitter.fire(), this));
		this._register(this.cellModel.onExecutionStateChange(event => {
			if (event === CellExecutionState.Running) {
				this.setFocusAndScroll();
			}
		}));
		this.layout();
	}

	public layout(): void {
		this._editor.layout(new DOM.Dimension(
			DOM.getContentWidth(this.codeElement.nativeElement),
			DOM.getContentHeight(this.codeElement.nativeElement)));
		this._editor.setHeightToScrollHeight();
	}

	protected initActionBar() {
		let context = new CellContext(this.model, this.cellModel);
		let runCellAction = this._instantiationService.createInstance(RunCellAction, context);

		let taskbar = <HTMLElement>this.toolbarElement.nativeElement;
		this._actionBar = new Taskbar(taskbar);
		this._actionBar.context = context;
		this._actionBar.setContent([
			{ action: runCellAction }
		]);
		this._cellToggleMoreActions.onInit(this.moreActionsElementRef, this.model, this.cellModel);
	}

	/// Editor Functions
	private updateModel() {
		if (this._editorModel) {
			this._modelService.updateModel(this._editorModel, this.cellModel.source);
		}
	}

	private checkForLanguageMagics(): void {
		try {
			if (!this.cellModel || this.cellModel.cellType !== CellTypes.Code) {
				return;
			}
			if (this._editorModel && this._editor && this._editorModel.getLineCount() > 1) {
				// Only try to match once we've typed past the first line
				let magicName = notebookUtils.tryMatchCellMagic(this._editorModel.getLineContent(1));
				if (magicName) {
					let kernelName = this._model.clientSession && this._model.clientSession.kernel ? this._model.clientSession.kernel.name : undefined;
					let magic = this._model.notebookOptions.cellMagicMapper.toLanguageMagic(magicName, kernelName);
					if (magic && this.cellModel.language !== magic.language) {
						this.cellModel.setOverrideLanguage(magic.language);
						this.updateLanguageMode();
					}
				} else {
					this.cellModel.setOverrideLanguage(undefined);
				}
			}
		} catch (err) {
			// No-op for now. Should we log?
		}
	}

	private updateLanguageMode(): void {
		if (this._editorModel && this._editor) {
			let modeValue = this._modeService.create(this.cellModel.language);
			this._modelService.setMode(this._editorModel, modeValue);
		}
	}

	private updateTheme(theme: IColorTheme): void {
		let toolbarEl = <HTMLElement>this.toolbarElement.nativeElement;
		toolbarEl.style.borderRightColor = theme.getColor(themeColors.SIDE_BAR_BACKGROUND, true).toString();

		let moreActionsEl = <HTMLElement>this.moreActionsElementRef.nativeElement;
		moreActionsEl.style.borderRightColor = theme.getColor(themeColors.SIDE_BAR_BACKGROUND, true).toString();
	}

	private setFocusAndScroll(): void {
		if (this.cellModel.id === this._activeCellId) {
			this._editor.focus();
			this._editor.getContainer().scrollIntoView({ behavior: 'smooth', block: 'nearest' });
		}
	}

	protected isActive() {
		return this.cellModel && this.cellModel.id === this.activeCellId;
	}

	protected toggleMoreActionsButton(isActiveOrHovered: boolean) {
		this._cellToggleMoreActions.toggleVisible(!isActiveOrHovered);
	}
}
