// Adopted and converted to typescript from https://github.com/6pac/SlickGrid/blob/master/plugins/slick.checkboxselectcolumn.js

import { mixin } from 'vs/base/common/objects';
import * as nls from 'vs/nls';
import { ICheckboxStyles } from 'vs/base/browser/ui/checkbox/checkbox';
import { Emitter, Event as vsEvent } from 'vs/base/common/event';
import * as strings from 'vs/base/common/strings';
import { StandardKeyboardEvent } from 'vs/base/browser/keyboardEvent';
import { KeyCode } from 'vs/base/common/keyCodes';
import { range } from 'vs/base/common/arrays';

export interface ICheckboxSelectColumnOptions extends Slick.PluginOptions, ICheckboxStyles {
	columnId?: string;
	cssClass?: string;
	headerCssClass?: string;
	toolTip?: string;
	width?: number;
	title?: string;
	columnIndex?: number;
	actionOnCheck?: ActionOnCheck;
}

// Actions expected on checkbox click
export enum ActionOnCheck {
	selectRow = 0,
	customAction = 1
}

export interface ICheckboxCellActionEventArgs {
	checked: boolean;
	row: number;
	column: number;
}

const defaultOptions: ICheckboxSelectColumnOptions = {
	columnId: '_checkbox_selector',
	cssClass: undefined,
	headerCssClass: undefined,
	toolTip: nls.localize('selectDeselectAll', 'Select/Deselect All'),
	width: 30
};

const checkboxTemplate = `<div style="display: flex; align-items: center; flex-direction: column">
								<input type="checkbox" {0}>
							</div>`;

export class CheckboxSelectColumn<T> implements Slick.Plugin<T> {
	private _options: ICheckboxSelectColumnOptions;
	private _grid: Slick.Grid<T>;
	private _handler = new Slick.EventHandler();
	private _selectedRowsLookup = {};
	private _selectedCheckBoxLookup = {};
	private _useState = false;

	private _onChange = new Emitter<ICheckboxCellActionEventArgs>();
	public readonly onChange: vsEvent<ICheckboxCellActionEventArgs> = this._onChange.event;
	public index: number;

	constructor(options?: ICheckboxSelectColumnOptions, columnIndex?: number) {
		this._options = mixin(options, defaultOptions, false);
		this.index = columnIndex ? columnIndex : 0;
	}

	public init(grid: Slick.Grid<T>): void {
		this._grid = grid;
		this._handler
			.subscribe(this._grid.onSelectedRowsChanged, (e, args) => this.handleSelectedRowsChanged(e, args))
			.subscribe(this._grid.onClick, (e, args) => this.handleClick(e, args))
			.subscribe(this._grid.onHeaderClick, (e, args) => this.handleHeaderClick(e, args))
			.subscribe(this._grid.onKeyDown, (e, args) => this.handleKeyDown(e, args));
	}

	public destroy(): void {
		this._handler.unsubscribeAll();
	}

	private handleSelectedRowsChanged(e: Event, args: Slick.OnSelectedRowsChangedEventArgs<T>): void {
		if (this.isCustomActionRequested()) {
			// do not assume anything for column based on row selection
			// we can emit event here later if required.
			return;
		}

		const selectedRows = this._grid.getSelectedRows();
		let lookup = {}, row, i;
		for (i = 0; i < selectedRows.length; i++) {
			row = selectedRows[i];
			lookup[row] = true;
			if (lookup[row] !== this._selectedRowsLookup[row]) {
				this._grid.invalidateRow(row);
				delete this._selectedRowsLookup[row];
			}
		}
		for (i in this._selectedRowsLookup) {
			this._grid.invalidateRow(i);
		}
		this._selectedRowsLookup = lookup;
		this._grid.render();

		if (!this._options.title) {
			if (selectedRows.length && selectedRows.length === this._grid.getDataLength()) {
				this._grid.updateColumnHeader(this._options.columnId!,
					strings.format(checkboxTemplate, 'checked'),
					this._options.toolTip);
			} else {
				this._grid.updateColumnHeader(this._options.columnId!,
					strings.format(checkboxTemplate, ''),
					this._options.toolTip);
			}
		}
	}

	private handleKeyDown(e: KeyboardEvent, args: Slick.OnKeyDownEventArgs<T>): void {
		if (e.which === 32) {
			if (this._grid.getColumns()[args.cell].id === this._options.columnId) {
				// if editing, try to commit
				if (!this._grid.getEditorLock().isActive() || this._grid.getEditorLock().commitCurrentEdit()) {
					if (this.isCustomActionRequested()) {
						this.toggleCheckBox(args.row, args.cell, true);
					}
					else {
						this.toggleRowSelection(args.row);
					}
				}
				e.preventDefault();
				e.stopImmediatePropagation();
			}
		} else {
			let event = new StandardKeyboardEvent(e);
			if (event.equals(KeyCode.Enter)) {
				// clicking on a row select checkbox
				if (this._grid.getColumns()[args.cell].id === this._options.columnId) {
					if (this.isCustomActionRequested()) {
						this.toggleCheckBox(args.row, args.cell, true);
					}
					else {
						this.toggleRowSelection(args.row);
					}
					e.stopPropagation();
					e.stopImmediatePropagation();
				}
			}
		}
	}

	private handleClick(e: Event, args: Slick.OnClickEventArgs<T>): void {
		// clicking on a row select checkbox
		if (this._grid.getColumns()[args.cell].id === this._options.columnId && jQuery(e.target!).is('input[type="checkbox"]')) {
			// if editing, try to commit
			if (this._grid.getEditorLock().isActive() && !this._grid.getEditorLock().commitCurrentEdit()) {
				e.preventDefault();
				e.stopImmediatePropagation();
				return;
			}

			if (this.isCustomActionRequested()) {
				this.toggleCheckBox(args.row, args.cell, false);
			}
			else {
				this.toggleRowSelection(args.row);
			}
			e.stopPropagation();
			e.stopImmediatePropagation();
		}
	}

	private toggleRowSelection(row: number): void {
		if (this._selectedRowsLookup[row]) {
			this._grid.setSelectedRows(this._grid.getSelectedRows().filter(n => n !== row));
		} else {
			this._grid.setSelectedRows(this._grid.getSelectedRows().concat(row));
		}
	}

	private toggleCheckBox(row: number, col: number, reRender: boolean): void {
		this._useState = true;

		if (this._selectedCheckBoxLookup[row]) {
			delete this._selectedCheckBoxLookup[row];
			this._onChange.fire({ checked: false, row: row, column: col });
		} else {
			this._selectedCheckBoxLookup[row] = true;
			this._onChange.fire({ checked: true, row: row, column: col });
		}

		if (reRender) {
			// ensure that grid reflects the change
			this._grid.invalidateRow(row);
			this._grid.render();
		}
	}

	private handleHeaderClick(e: Event, args: Slick.OnHeaderClickEventArgs<T>): void {
		if (this.isCustomActionRequested()) {
			// do not assume action for column based on header click.
			// we can emit event here later if required.
			return;
		}
		if (!this._options.title && args.column.id === this._options.columnId && jQuery(e.target!).is('input[type="checkbox"]')) {
			// if editing, try to commit
			if (this._grid.getEditorLock().isActive() && !this._grid.getEditorLock().commitCurrentEdit()) {
				e.preventDefault();
				e.stopImmediatePropagation();
				return;
			}

			if (jQuery(e.target!).is('input[checked]')) {
				const rows = range(this._grid.getDataLength());
				this._grid.setSelectedRows(rows);
				this._grid.updateColumnHeader(this._options.columnId!,
					strings.format(checkboxTemplate, 'checked'),
					this._options.toolTip);
			} else {
				this._grid.setSelectedRows([]);
				this._grid.updateColumnHeader(this._options.columnId!,
					strings.format(checkboxTemplate, ''), this._options.toolTip);
				e.stopPropagation();
				e.stopImmediatePropagation();
			}
		}
	}

	public getColumnDefinition(): Slick.Column<T> {
		return {
			id: this._options.columnId,
			name: this._options.title || strings.format(checkboxTemplate, ''),
			toolTip: this._options.toolTip,
			field: 'sel',
			width: this._options.width,
			resizable: false,
			sortable: false,
			cssClass: this._options.cssClass,
			headerCssClass: this._options.headerCssClass,
			formatter: (r, c, v, cd, dc) => this.checkboxSelectionFormatter(r, c, v, cd, dc)
		};
	}

	private checkboxSelectionFormatter(row, cell, value, columnDef: Slick.Column<T>, dataContext): string {
		if (this.isCustomActionRequested()) {
			return this.checkboxTemplateCustom(row);
		}

		return this._selectedRowsLookup[row]
			? strings.format(checkboxTemplate, 'checked')
			: strings.format(checkboxTemplate, '');
	}

	checkboxTemplateCustom(row: number): string {
		// use state after toggles
		if (this._useState) {
			return this._selectedCheckBoxLookup[row]
				? strings.format(checkboxTemplate, 'checked')
				: strings.format(checkboxTemplate, '');
		}

		// use data for first time rendering
		// note: make sure Init is called before using this._grid
		let rowVal = (this._grid) ? this._grid.getDataItem(row) : null;
		if (rowVal && this._options.title && rowVal[this._options.title] === true) {
			this._selectedCheckBoxLookup[row] = true;
			return strings.format(checkboxTemplate, 'checked');
		}
		else {
			delete this._selectedCheckBoxLookup[row];
			return strings.format(checkboxTemplate, '');
		}
	}

	private isCustomActionRequested(): boolean {
		return (this._options.actionOnCheck === ActionOnCheck.customAction);
	}
}
