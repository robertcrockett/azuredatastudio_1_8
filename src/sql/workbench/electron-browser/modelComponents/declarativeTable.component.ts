/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import 'vs/css!./media/declarativeTable';

import {
	Component, Input, Inject, ChangeDetectorRef, forwardRef, ViewChild, ElementRef, OnDestroy, AfterViewInit
} from '@angular/core';

import * as azdata from 'azdata';

import { ComponentBase } from 'sql/workbench/electron-browser/modelComponents/componentBase';
import { IComponent, IComponentDescriptor, IModelStore, ComponentEventType } from 'sql/workbench/electron-browser/modelComponents/interfaces';
import { ISelectData } from 'vs/base/browser/ui/selectBox/selectBox';

export enum DeclarativeDataType {
	string = 'string',
	category = 'category',
	boolean = 'boolean',
	editableCategory = 'editableCategory'
}

@Component({
	selector: 'modelview-declarativeTable',
	template: `
	<table role=grid aria-labelledby="ID_REF" #container *ngIf="columns" class="declarative-table" [style.height]="getHeight()">
	<thead>
		<ng-container *ngFor="let column of columns;let h = index">
		<th class="declarative-table-header" tabindex="-1" role="button" aria-sort="none">{{column.displayName}}</th>
		</ng-container>
	</thead>
		<ng-container *ngIf="data">
			<ng-container *ngFor="let row of data;let r = index">
				<tr class="declarative-table-row" >
					<ng-container *ngFor="let cellData of row;let c = index">
						<td class="declarative-table-cell" tabindex="-1" role="button" [style.width]="getColumnWidth(c)">
							<checkbox *ngIf="isCheckBox(c)" label="" (onChange)="onCheckBoxChanged($event,r,c)" [enabled]="isControlEnabled(c)" [checked]="isChecked(r,c)"></checkbox>
							<select-box *ngIf="isSelectBox(c)" [options]="GetOptions(c)" (onDidSelect)="onSelectBoxChanged($event,r,c)" [selectedOption]="GetSelectedOptionDisplayName(r,c)"></select-box>
							<editable-select-box *ngIf="isEditableSelectBox(c)" [options]="GetOptions(c)" (onDidSelect)="onSelectBoxChanged($event,r,c)" [selectedOption]="GetSelectedOptionDisplayName(r,c)"></editable-select-box>
							<input-box *ngIf="isInputBox(c)" [value]="cellData" (onDidChange)="onInputBoxChanged($event,r,c)"></input-box>
							<ng-container *ngIf="isLabel(c)" >{{cellData}}</ng-container>
						</td>
					</ng-container>
				</tr>
			</ng-container>
		</ng-container>
	</table>
	`
})
export default class DeclarativeTableComponent extends ComponentBase implements IComponent, OnDestroy, AfterViewInit {
	@Input() descriptor: IComponentDescriptor;
	@Input() modelStore: IModelStore;

	@ViewChild('container', { read: ElementRef }) private _tableContainer: ElementRef;
	constructor(
		@Inject(forwardRef(() => ChangeDetectorRef)) changeRef: ChangeDetectorRef,
		@Inject(forwardRef(() => ElementRef)) el: ElementRef
	) {
		super(changeRef, el);
	}

	ngOnInit(): void {
		this.baseInit();
	}

	ngAfterViewInit(): void {
	}

	public validate(): Thenable<boolean> {
		return super.validate().then(valid => {
			return valid;
		});
	}

	ngOnDestroy(): void {
		this.baseDestroy();
	}

	private isCheckBox(cell: number): boolean {
		let column: azdata.DeclarativeTableColumn = this.columns[cell];
		return column.valueType === DeclarativeDataType.boolean;
	}

	private isControlEnabled(cell: number): boolean {
		let column: azdata.DeclarativeTableColumn = this.columns[cell];
		return !column.isReadOnly;
	}

	private isLabel(cell: number): boolean {
		let column: azdata.DeclarativeTableColumn = this.columns[cell];
		return column.isReadOnly && column.valueType === DeclarativeDataType.string;
	}

	private isChecked(row: number, cell: number): boolean {
		let cellData = this.data[row][cell];
		return cellData;
	}

	private onInputBoxChanged(e: string, row: number, cell: number): void {
		this.onCellDataChanged(e, row, cell);
	}

	private onCheckBoxChanged(e: boolean, row: number, cell: number): void {
		this.onCellDataChanged(e, row, cell);
	}

	private onSelectBoxChanged(e: ISelectData | string, row: number, cell: number): void {

		let column: azdata.DeclarativeTableColumn = this.columns[cell];
		if (column.categoryValues) {
			if (typeof e === 'string') {
				let category = column.categoryValues.find(c => c.displayName === e);
				if (category) {
					this.onCellDataChanged(category.name, row, cell);
				} else {
					this.onCellDataChanged(e, row, cell);
				}
			} else {
				this.onCellDataChanged(column.categoryValues[e.index].name, row, cell);
			}
		}
	}

	private onCellDataChanged(newValue: any, row: number, cell: number): void {
		this.data[row][cell] = newValue;
		this.data = this.data;
		let newCellData: azdata.TableCell = {
			row: row,
			column: cell,
			value: newValue
		};
		this.fireEvent({
			eventType: ComponentEventType.onDidChange,
			args: newCellData
		});
	}

	private isSelectBox(cell: number): boolean {
		let column: azdata.DeclarativeTableColumn = this.columns[cell];
		return column.valueType === DeclarativeDataType.category;
	}

	private isEditableSelectBox(cell: number): boolean {
		let column: azdata.DeclarativeTableColumn = this.columns[cell];
		return column.valueType === DeclarativeDataType.editableCategory;
	}

	private isInputBox(cell: number): boolean {
		let column: azdata.DeclarativeTableColumn = this.columns[cell];
		return column.valueType === DeclarativeDataType.string && !column.isReadOnly;
	}

	private getColumnWidth(cell: number): string {
		let column: azdata.DeclarativeTableColumn = this.columns[cell];
		return this.convertSize(column.width, '30px');
	}

	private GetOptions(cell: number): string[] {
		let column: azdata.DeclarativeTableColumn = this.columns[cell];
		return column.categoryValues ? column.categoryValues.map(x => x.displayName) : [];
	}

	private GetSelectedOptionDisplayName(row: number, cell: number): string {
		let column: azdata.DeclarativeTableColumn = this.columns[cell];
		let cellData = this.data[row][cell];
		if (cellData && column.categoryValues) {
			let category = column.categoryValues.find(v => v.name === cellData);
			if (category) {
				return category.displayName;
			} else if (this.isEditableSelectBox(cell)) {
				return cellData;
			} else {
				return undefined;
			}
		} else {
			return '';
		}
	}

	/// IComponent implementation

	public setLayout(layout: any): void {
		// TODO allow configuring the look and feel
		this.layout();
	}

	public setProperties(properties: { [key: string]: any; }): void {
		super.setProperties(properties);
	}

	public get data(): any[][] {
		return this.getPropertyOrDefault<azdata.DeclarativeTableProperties, any[]>((props) => props.data, []);
	}

	public set data(newValue: any[][]) {
		this.setPropertyFromUI<azdata.DeclarativeTableProperties, any[][]>((props, value) => props.data = value, newValue);
	}

	public get columns(): azdata.DeclarativeTableColumn[] {
		return this.getPropertyOrDefault<azdata.DeclarativeTableProperties, azdata.DeclarativeTableColumn[]>((props) => props.columns, []);
	}

	public set columns(newValue: azdata.DeclarativeTableColumn[]) {
		this.setPropertyFromUI<azdata.DeclarativeTableProperties, azdata.DeclarativeTableColumn[]>((props, value) => props.columns = value, newValue);
	}
}
