/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import 'vs/css!./media/queryActions';
import * as nls from 'vs/nls';
import { Action, IActionViewItem, IActionRunner } from 'vs/base/common/actions';
import { IDisposable, dispose } from 'vs/base/common/lifecycle';
import { IContextViewService } from 'vs/platform/contextview/browser/contextView';
import { IConfigurationService } from 'vs/platform/configuration/common/configuration';
import { IThemeService } from 'vs/platform/theme/common/themeService';
import { INotificationService } from 'vs/platform/notification/common/notification';
import Severity from 'vs/base/common/severity';
import { append, $ } from 'vs/base/browser/dom';

import { ISelectionData } from 'azdata';
import {
	IConnectionManagementService,
	IConnectionParams,
	INewConnectionParams,
	ConnectionType,
	RunQueryOnConnectionMode
} from 'sql/platform/connection/common/connectionManagement';
import { QueryEditor } from 'sql/workbench/parts/query/browser/queryEditor';
import { IQueryModelService } from 'sql/platform/query/common/queryModel';
import { SelectBox } from 'sql/base/browser/ui/selectBox/selectBox';
import { attachEditableDropdownStyler, attachSelectBoxStyler } from 'sql/platform/theme/common/styler';
import { Dropdown } from 'sql/base/parts/editableDropdown/browser/dropdown';

/**
 * Action class that query-based Actions will extend. This base class automatically handles activating and
 * deactivating the button when a SQL file is opened.
 */
export abstract class QueryTaskbarAction extends Action {

	private _classes: string[];

	constructor(
		protected readonly connectionManagementService: IConnectionManagementService,
		protected readonly editor: QueryEditor,
		id: string,
		enabledClass: string
	) {
		super(id);
		this.enabled = true;
		this._setCssClass(enabledClass);
	}

	/**
	 * This method is executed when the button is clicked.
	 */
	public abstract run(): Promise<void>;

	protected updateCssClass(enabledClass: string): void {
		// set the class, useful on change of label or icon
		this._setCssClass(enabledClass);
	}

	/**
	 * Sets the CSS classes combining the parent and child classes.
	 * Public for testing only.
	 */
	private _setCssClass(enabledClass: string): void {
		this._classes = [];

		if (enabledClass) {
			this._classes.push(enabledClass);
		}
		this.class = this._classes.join(' ');
	}

	/**
	 * Returns the URI of the given editor if it is not undefined and is connected.
	 * Public for testing only.
	 */
	public isConnected(editor: QueryEditor): boolean {
		if (!editor || !editor.input) {
			return false;
		}
		return this.connectionManagementService.isConnected(editor.input.uri);
	}

	/**
	 * Connects the given editor to it's current URI.
	 * Public for testing only.
	 */
	protected connectEditor(editor: QueryEditor, runQueryOnCompletion?: RunQueryOnConnectionMode, selection?: ISelectionData): void {
		let params: INewConnectionParams = {
			input: editor.input,
			connectionType: ConnectionType.editor,
			runQueryOnCompletion: runQueryOnCompletion ? runQueryOnCompletion : RunQueryOnConnectionMode.none,
			querySelection: selection
		};
		this.connectionManagementService.showConnectionDialog(params);
	}
}

/**
 * Action class that runs a query in the active SQL text document.
 */
export class RunQueryAction extends QueryTaskbarAction {

	public static EnabledClass = 'start';
	public static ID = 'runQueryAction';

	constructor(
		editor: QueryEditor,
		@IQueryModelService protected readonly queryModelService: IQueryModelService,
		@IConnectionManagementService connectionManagementService: IConnectionManagementService
	) {
		super(connectionManagementService, editor, RunQueryAction.ID, RunQueryAction.EnabledClass);
		this.label = nls.localize('runQueryLabel', 'Run');
	}

	public run(): Promise<void> {
		if (!this.editor.isSelectionEmpty()) {
			if (this.isConnected(this.editor)) {
				// If we are already connected, run the query
				this.runQuery(this.editor);
			} else {
				// If we are not already connected, prompt for connection and run the query if the
				// connection succeeds. "runQueryOnCompletion=true" will cause the query to run after connection
				this.connectEditor(this.editor, RunQueryOnConnectionMode.executeQuery, this.editor.getSelection());
			}
		}
		return Promise.resolve(null);
	}

	public runCurrent(): Promise<void> {
		if (!this.editor.isSelectionEmpty()) {
			if (this.isConnected(this.editor)) {
				// If we are already connected, run the query
				this.runQuery(this.editor, true);
			} else {
				// If we are not already connected, prompt for connection and run the query if the
				// connection succeeds. "runQueryOnCompletion=true" will cause the query to run after connection
				this.connectEditor(this.editor, RunQueryOnConnectionMode.executeCurrentQuery, this.editor.getSelection(false));
			}
		}
		return Promise.resolve(null);
	}

	public runQuery(editor: QueryEditor, runCurrentStatement: boolean = false) {
		if (!editor) {
			editor = this.editor;
		}

		if (this.isConnected(editor)) {
			// if the selection isn't empty then execute the selection
			// otherwise, either run the statement or the script depending on parameter
			let selection: ISelectionData = editor.getSelection(false);
			if (runCurrentStatement && selection && this.isCursorPosition(selection)) {
				editor.input.runQueryStatement(selection);
			} else {
				// get the selection again this time with trimming
				selection = editor.getSelection();
				editor.input.runQuery(selection);
			}
		}
	}

	protected isCursorPosition(selection: ISelectionData) {
		return selection.startLine === selection.endLine
			&& selection.startColumn === selection.endColumn;
	}
}

/**
 * Action class that cancels the running query in the current SQL text document.
 */
export class CancelQueryAction extends QueryTaskbarAction {

	public static EnabledClass = 'stop';
	public static ID = 'cancelQueryAction';

	constructor(
		editor: QueryEditor,
		@IQueryModelService private readonly queryModelService: IQueryModelService,
		@IConnectionManagementService connectionManagementService: IConnectionManagementService
	) {
		super(connectionManagementService, editor, CancelQueryAction.ID, CancelQueryAction.EnabledClass);
		this.enabled = false;
		this.label = nls.localize('cancelQueryLabel', 'Cancel');
	}

	public run(): Promise<void> {
		if (this.isConnected(this.editor)) {
			this.queryModelService.cancelQuery(this.editor.input.uri);
		}
		return Promise.resolve(null);
	}
}

/**
 * Action class that runs a query in the active SQL text document.
 */
export class EstimatedQueryPlanAction extends QueryTaskbarAction {

	public static EnabledClass = 'estimatedQueryPlan';
	public static ID = 'estimatedQueryPlanAction';

	constructor(
		editor: QueryEditor,
		@IConnectionManagementService connectionManagementService: IConnectionManagementService
	) {
		super(connectionManagementService, editor, EstimatedQueryPlanAction.ID, EstimatedQueryPlanAction.EnabledClass);
		this.label = nls.localize('estimatedQueryPlan', 'Explain');
	}

	public run(): Promise<void> {
		if (!this.editor.isSelectionEmpty()) {
			if (this.isConnected(this.editor)) {
				// If we are already connected, run the query
				this.runQuery(this.editor);
			} else {
				// If we are not already connected, prompt for connection and run the query if the
				// connection succeeds. "runQueryOnCompletion=true" will cause the query to run after connection
				this.connectEditor(this.editor, RunQueryOnConnectionMode.estimatedQueryPlan, this.editor.getSelection());
			}
		}
		return Promise.resolve(null);
	}

	public runQuery(editor: QueryEditor) {
		if (!editor) {
			editor = this.editor;
		}

		if (this.isConnected(editor)) {
			editor.input.runQuery(editor.getSelection(), {
				displayEstimatedQueryPlan: true
			});
		}
	}
}

export class ActualQueryPlanAction extends QueryTaskbarAction {
	public static EnabledClass = 'actualQueryPlan';
	public static ID = 'actualQueryPlanAction';

	constructor(
		editor: QueryEditor,
		@IConnectionManagementService connectionManagementService: IConnectionManagementService
	) {
		super(connectionManagementService, editor, ActualQueryPlanAction.ID, ActualQueryPlanAction.EnabledClass);
		this.label = nls.localize('actualQueryPlan', "Actual");
	}

	public run(): Promise<void> {
		if (!this.editor.isSelectionEmpty()) {
			if (this.isConnected(this.editor)) {
				// If we are already connected, run the query
				this.runQuery(this.editor);
			} else {
				// If we are not already connected, prompt for connection and run the query if the
				// connection succeeds. "runQueryOnCompletion=true" will cause the query to run after connection
				this.connectEditor(this.editor, RunQueryOnConnectionMode.actualQueryPlan, this.editor.getSelection());
			}
		}
		return Promise.resolve(null);
	}

	public runQuery(editor: QueryEditor) {
		if (!editor) {
			editor = this.editor;
		}

		if (this.isConnected(editor)) {
			let selection = editor.getSelection();
			if (!selection) {
				selection = editor.getAllSelection();
			}
			editor.input.runQuery(selection, {
				displayActualQueryPlan: true
			});
		}
	}
}

/**
 * Action class that disconnects the connection associated with the current query file.
 */
export class DisconnectDatabaseAction extends QueryTaskbarAction {

	public static EnabledClass = 'disconnect';
	public static ID = 'disconnectDatabaseAction';

	constructor(
		editor: QueryEditor,
		@IConnectionManagementService connectionManagementService: IConnectionManagementService
	) {
		super(connectionManagementService, editor, DisconnectDatabaseAction.ID, DisconnectDatabaseAction.EnabledClass);
		this.label = nls.localize('disconnectDatabaseLabel', 'Disconnect');
	}

	public run(): Promise<void> {
		// Call disconnectEditor regardless of the connection state and let the ConnectionManagementService
		// determine if we need to disconnect, cancel an in-progress conneciton, or do nothing
		this.connectionManagementService.disconnectEditor(this.editor.input);
		return Promise.resolve(null);
	}
}

/**
 * Action class that launches a connection dialogue for the current query file
 */
export class ConnectDatabaseAction extends QueryTaskbarAction {

	public static EnabledDefaultClass = 'connect';
	public static EnabledChangeClass = 'changeConnection';
	public static ID = 'connectDatabaseAction';

	constructor(
		editor: QueryEditor,
		isChangeConnectionAction: boolean,
		@IConnectionManagementService connectionManagementService: IConnectionManagementService
	) {
		let label: string;
		let enabledClass: string;

		if (isChangeConnectionAction) {
			enabledClass = ConnectDatabaseAction.EnabledChangeClass;
			label = nls.localize('changeConnectionDatabaseLabel', 'Change Connection');
		} else {
			enabledClass = ConnectDatabaseAction.EnabledDefaultClass;
			label = nls.localize('connectDatabaseLabel', 'Connect');
		}

		super(connectionManagementService, editor, ConnectDatabaseAction.ID, enabledClass);

		this.label = label;
	}

	public run(): Promise<void> {
		this.connectEditor(this.editor);
		return Promise.resolve(null);
	}
}

/**
 * Action class that either launches a connection dialogue for the current query file,
 * or disconnects the active connection
 */
export class ToggleConnectDatabaseAction extends QueryTaskbarAction {

	public static ConnectClass = 'connect';
	public static DisconnectClass = 'disconnect';
	public static ID = 'toggleConnectDatabaseAction';

	private _connectLabel = nls.localize('connectDatabaseLabel', 'Connect');
	private _disconnectLabel = nls.localize('disconnectDatabaseLabel', 'Disconnect');
	constructor(
		editor: QueryEditor,
		private _connected: boolean,
		@IConnectionManagementService connectionManagementService: IConnectionManagementService
	) {
		super(connectionManagementService, editor, ToggleConnectDatabaseAction.ID, undefined);
	}

	public get connected(): boolean {
		return this._connected;
	}

	public set connected(value: boolean) {
		// intentionally always updating, since parent class handles skipping if values
		this._connected = value;
		this.updateLabelAndIcon();
	}

	private updateLabelAndIcon(): void {
		if (this._connected) {
			// We are connected, so show option to disconnect
			this.label = this._disconnectLabel;
			this.updateCssClass(ToggleConnectDatabaseAction.DisconnectClass);
		} else {
			this.label = this._connectLabel;
			this.updateCssClass(ToggleConnectDatabaseAction.ConnectClass);
		}
	}

	public run(): Promise<void> {
		if (this.connected) {
			// Call disconnectEditor regardless of the connection state and let the ConnectionManagementService
			// determine if we need to disconnect, cancel an in-progress connection, or do nothing
			this.connectionManagementService.disconnectEditor(this.editor.input);
		} else {
			this.connectEditor(this.editor);
		}
		return Promise.resolve(null);
	}
}

/**
 * Action class that is tied with ListDatabasesActionItem.
 */
export class ListDatabasesAction extends QueryTaskbarAction {

	public static EnabledClass = '';
	public static ID = 'listDatabaseQueryAction';

	constructor(
		editor: QueryEditor,
		@IConnectionManagementService connectionManagementService: IConnectionManagementService
	) {
		super(connectionManagementService, editor, ListDatabasesAction.ID, undefined);
		this.enabled = false;
		this.class = ListDatabasesAction.EnabledClass;
	}

	public run(): Promise<void> {
		return Promise.resolve(null);
	}
}

/*
 * Action item that handles the dropdown (combobox) that lists the available databases.
 * Based off StartDebugActionItem.
 */
export class ListDatabasesActionItem implements IActionViewItem {
	public static ID = 'listDatabaseQueryActionItem';

	public actionRunner: IActionRunner;
	private _toDispose: IDisposable[];
	private _context: any;
	private _currentDatabaseName: string;
	private _isConnected: boolean;
	private _databaseListDropdown: HTMLElement;
	private _dropdown: Dropdown;
	private _databaseSelectBox: SelectBox;
	private _isInAccessibilityMode: boolean;
	private readonly _selectDatabaseString: string = nls.localize("selectDatabase", "Select Database");

	// CONSTRUCTOR /////////////////////////////////////////////////////////
	constructor(
		private _editor: QueryEditor,
		@IContextViewService contextViewProvider: IContextViewService,
		@IConnectionManagementService private readonly connectionManagementService: IConnectionManagementService,
		@INotificationService private readonly notificationService: INotificationService,
		@IConfigurationService private readonly configurationService: IConfigurationService
	) {
		this._toDispose = [];
		this._databaseListDropdown = $('.databaseListDropdown');
		this._isInAccessibilityMode = this.configurationService.getValue('editor.accessibilitySupport') === 'on';

		if (this._isInAccessibilityMode) {
			this._databaseSelectBox = new SelectBox([this._selectDatabaseString], this._selectDatabaseString, contextViewProvider, undefined, { ariaLabel: this._selectDatabaseString });
			this._databaseSelectBox.render(this._databaseListDropdown);
			this._databaseSelectBox.onDidSelect(e => { this.databaseSelected(e.selected); });
			this._databaseSelectBox.disable();

		} else {
			this._dropdown = new Dropdown(this._databaseListDropdown, contextViewProvider, {
				strictSelection: true,
				placeholder: this._selectDatabaseString,
				ariaLabel: this._selectDatabaseString,
				actionLabel: nls.localize('listDatabases.toggleDatabaseNameDropdown', 'Select Database Toggle Dropdown')
			});
			this._dropdown.onValueChange(s => this.databaseSelected(s));
			this._toDispose.push(this._dropdown.onFocus(() => this.onDropdownFocus()));
		}

		// Register event handlers
		this._toDispose.push(this.connectionManagementService.onConnectionChanged(params => this.onConnectionChanged(params)));
	}

	// PUBLIC METHODS //////////////////////////////////////////////////////
	public render(container: HTMLElement): void {
		append(container, this._databaseListDropdown);
	}

	public style(styles) {
		if (this._isInAccessibilityMode) {
			this._databaseSelectBox.style(styles);
		}
		else {
			this._dropdown.style(styles);
		}
	}

	public setActionContext(context: any): void {
		this._context = context;
	}

	public isEnabled(): boolean {
		return !!this._isConnected;
	}

	public focus(): void {
		if (this._isInAccessibilityMode) {
			this._databaseSelectBox.focus();
		} else {
			this._dropdown.focus();
		}
	}

	public blur(): void {
		if (this._isInAccessibilityMode) {
			this._databaseSelectBox.blur();
		} else {
			this._dropdown.blur();
		}
	}

	public attachStyler(themeService: IThemeService): IDisposable {
		if (this._isInAccessibilityMode) {
			return attachSelectBoxStyler(this, themeService);
		} else {
			return attachEditableDropdownStyler(this, themeService);
		}
	}

	public dispose(): void {
		this._toDispose = dispose(this._toDispose);
	}

	// EVENT HANDLERS FROM EDITOR //////////////////////////////////////////
	public onConnected(): void {
		let dbName = this.getCurrentDatabaseName();
		this.updateConnection(dbName);
	}

	public onDisconnect(): void {
		this._isConnected = false;
		this._currentDatabaseName = undefined;

		if (this._isInAccessibilityMode) {
			this._databaseSelectBox.disable();
			this._databaseSelectBox.setOptions([this._selectDatabaseString]);
		} else {
			this._dropdown.enabled = false;
			this._dropdown.value = '';
		}
	}

	// PRIVATE HELPERS /////////////////////////////////////////////////////
	private databaseSelected(dbName: string): void {
		let uri = this._editor.input.uri;
		if (!uri) {
			return;
		}

		let profile = this.connectionManagementService.getConnectionProfile(uri);
		if (!profile) {
			return;
		}

		this.connectionManagementService.changeDatabase(this._editor.input.uri, dbName)
			.then(
				result => {
					if (!result) {
						this.resetDatabaseName();
						this.notificationService.notify({
							severity: Severity.Error,
							message: nls.localize('changeDatabase.failed', "Failed to change database")
						});
					}
				},
				error => {
					this.resetDatabaseName();
					this.notificationService.notify({
						severity: Severity.Error,
						message: nls.localize('changeDatabase.failedWithError', "Failed to change database {0}", error)
					});
				});
	}

	private getCurrentDatabaseName() {
		let uri = this._editor.input.uri;
		if (uri) {
			let profile = this.connectionManagementService.getConnectionProfile(uri);
			if (profile) {
				return profile.databaseName;
			}
		}
		return undefined;
	}

	private resetDatabaseName() {
		if (this._isInAccessibilityMode) {
			this._databaseSelectBox.selectWithOptionName(this.getCurrentDatabaseName());
		} else {
			this._dropdown.value = this.getCurrentDatabaseName();
		}
	}

	private onConnectionChanged(connParams: IConnectionParams): void {
		if (!connParams) {
			return;
		}

		let uri = this._editor.input.uri;
		if (uri !== connParams.connectionUri) {
			return;
		}

		this.updateConnection(connParams.connectionProfile.databaseName);
	}

	private onDropdownFocus(): void {
		let uri = this._editor.input.uri;
		if (!uri) {
			return;
		}

		this.connectionManagementService.listDatabases(uri)
			.then(result => {
				if (result && result.databaseNames) {
					this._dropdown.values = result.databaseNames;
				}
			});
	}

	private updateConnection(databaseName: string) {
		this._isConnected = true;
		this._currentDatabaseName = databaseName;

		if (this._isInAccessibilityMode) {
			this._databaseSelectBox.enable();
			let uri = this._editor.input.uri;
			if (!uri) {
				return;
			}
			this.connectionManagementService.listDatabases(uri)
				.then(result => {
					if (result && result.databaseNames) {
						this._databaseSelectBox.setOptions(result.databaseNames);
					}
					this._databaseSelectBox.selectWithOptionName(databaseName);
				});
		} else {
			this._dropdown.enabled = true;
			this._dropdown.value = databaseName;
		}
	}

	// TESTING PROPERTIES //////////////////////////////////////////////////
	public get currentDatabaseName(): string {
		return this._currentDatabaseName;
	}

}
