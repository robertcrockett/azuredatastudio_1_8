/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import 'vs/css!./dashboardGridContainer';

import { Component, Inject, Input, forwardRef, ElementRef, ViewChildren, QueryList, OnDestroy, ChangeDetectorRef } from '@angular/core';

import { CommonServiceInterface } from 'sql/platform/bootstrap/node/commonServiceInterface.service';
import { TabConfig, WidgetConfig } from 'sql/workbench/parts/dashboard/common/dashboardWidget';
import { DashboardWidgetWrapper } from 'sql/workbench/parts/dashboard/contents/dashboardWidgetWrapper.component';
import { DashboardTab } from 'sql/workbench/parts/dashboard/common/interfaces';
import { WebviewContent } from 'sql/workbench/parts/dashboard/contents/webviewContent.component';
import { TabChild } from 'sql/base/electron-browser/ui/panel/tab.component';

import { Event, Emitter } from 'vs/base/common/event';

export interface GridCellConfig {
	id?: string;
	row?: number;
	col?: number;
	colspan?: string | number;
	rowspan?: string | number;
}

export interface GridWidgetConfig extends GridCellConfig, WidgetConfig {
}

export interface GridWebviewConfig extends GridCellConfig {
	webview: {
		id?: string;
	};
}
export interface GridModelViewConfig extends GridCellConfig {
	widget: {
		modelview: {
			id?: string;
		}
	};
}

@Component({
	selector: 'dashboard-grid-container',
	templateUrl: decodeURI(require.toUrl('sql/workbench/parts/dashboard/containers/dashboardGridContainer.component.html')),
	providers: [{ provide: TabChild, useExisting: forwardRef(() => DashboardGridContainer) }]
})
export class DashboardGridContainer extends DashboardTab implements OnDestroy {
	@Input() private tab: TabConfig;
	private _contents: GridCellConfig[];
	private _onResize = new Emitter<void>();
	public readonly onResize: Event<void> = this._onResize.event;
	private cellWidth: number = 270;
	private cellHeight: number = 270;

	protected SKELETON_WIDTH = 5;

	protected rows: number[];
	protected cols: number[];

	protected getContent(row: number, col: number): GridCellConfig {
		const widget = this._contents.filter(w => w.row === row && w.col === col);
		return widget ? widget[0] : undefined;
	}

	protected getWidgetContent(row: number, col: number): GridWidgetConfig {
		const content = this.getContent(row, col);
		if (content) {
			const widgetConfig = <GridWidgetConfig>content;
			if (widgetConfig && widgetConfig.widget) {
				return widgetConfig;
			}
		}
		return undefined;
	}

	protected getWebviewContent(row: number, col: number): GridWebviewConfig {
		const content = this.getContent(row, col);
		if (content) {
			const webviewConfig = <GridWebviewConfig>content;
			if (webviewConfig && webviewConfig.webview) {
				return webviewConfig;
			}
		}
		return undefined;
	}

	protected getModelViewContent(row: number, col: number): GridModelViewConfig {
		const content = this.getContent(row, col);
		if (content) {
			const modelviewConfig = <GridModelViewConfig>content;
			if (modelviewConfig && modelviewConfig.widget.modelview) {
				return modelviewConfig;
			}
		}
		return undefined;
	}


	protected isWidget(row: number, col: number): boolean {
		const widgetConfig = this.getWidgetContent(row, col);
		return widgetConfig !== undefined;
	}

	protected isWebview(row: number, col: number): boolean {
		const webview = this.getWebviewContent(row, col);
		return webview !== undefined;
	}

	protected getWebviewId(row: number, col: number): string {
		const widgetConfig = this.getWebviewContent(row, col);
		if (widgetConfig && widgetConfig.webview) {
			return widgetConfig.webview.id;
		}
		return undefined;
	}

	protected isModelView(row: number, col: number): boolean {
		const modelView = this.getModelViewContent(row, col);
		return modelView !== undefined;
	}

	protected getModelViewId(row: number, col: number): string {
		const widgetConfig = this.getModelViewContent(row, col);
		if (widgetConfig && widgetConfig.widget.modelview) {
			return widgetConfig.widget.modelview.id;
		}
		return undefined;
	}
	protected getColspan(row: number, col: number): string {
		const content = this.getContent(row, col);
		let colspan: string = '1';
		if (content && content.colspan) {
			colspan = this.convertToNumber(content.colspan, this.cols.length).toString();
		}
		return colspan;
	}

	protected getRowspan(row: number, col: number): string {
		const content = this.getContent(row, col);
		if (content && (content.rowspan)) {
			return this.convertToNumber(content.rowspan, this.rows.length).toString();
		} else {
			return '1';
		}
	}

	protected getWidgetWidth(row: number, col: number): string {
		const colspan = this.getColspan(row, col);
		const columnCount = this.convertToNumber(colspan, this.cols.length);

		return columnCount * this.cellWidth + 'px';
	}

	protected getWidgetHeight(row: number, col: number): string {
		const rowspan = this.getRowspan(row, col);
		const rowCount = this.convertToNumber(rowspan, this.rows.length);

		return rowCount * this.cellHeight + 'px';
	}

	private convertToNumber(value: string | number, maxNumber: number): number {
		if (!value) {
			return 1;
		}
		if (value === '*') {
			return maxNumber;
		}
		try {
			return +value;
		} catch {
			return 1;
		}
	}

	@ViewChildren(DashboardWidgetWrapper) private _widgets: QueryList<DashboardWidgetWrapper>;
	@ViewChildren(WebviewContent) private _webViews: QueryList<WebviewContent>;
	constructor(
		@Inject(forwardRef(() => CommonServiceInterface)) protected dashboardService: CommonServiceInterface,
		@Inject(forwardRef(() => ElementRef)) protected _el: ElementRef,
		@Inject(forwardRef(() => ChangeDetectorRef)) protected _cd: ChangeDetectorRef
	) {
		super();
	}

	protected init() {
	}

	ngOnInit() {
		if (this.tab.container) {
			this._contents = Object.values(this.tab.container)[0];
			this._contents.forEach(widget => {
				if (!widget.row) {
					widget.row = 0;
				}
				if (!widget.col) {
					widget.col = 0;
				}
				if (!widget.colspan) {
					widget.colspan = '1';
				}
				if (!widget.rowspan) {
					widget.rowspan = '1';
				}
			});
			this.rows = this.createIndexes(this._contents.map(w => w.row));
			this.cols = this.createIndexes(this._contents.map(w => w.col));
		}
	}

	private createIndexes(indexes: number[]) {
		const max = Math.max(...indexes) + 1;
		return Array(max).fill(0).map((x, i) => i);
	}

	ngOnDestroy() {
		this.dispose();
	}

	public get id(): string {
		return this.tab.id;
	}

	public get editable(): boolean {
		return this.tab.editable;
	}

	public layout() {
		if (this._widgets) {
			this._widgets.forEach(item => {
				item.layout();
			});
		}
		if (this._webViews) {
			this._webViews.forEach(item => {
				item.layout();
			});
		}
	}

	public refresh(): void {
		if (this._widgets) {
			this._widgets.forEach(item => {
				item.refresh();
			});
		}
	}

	public enableEdit(): void {
	}
}
