/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Component, Inject, forwardRef, OnInit, ElementRef } from '@angular/core';

import { Event, Emitter } from 'vs/base/common/event';
import { IDisposable } from 'vs/base/common/lifecycle';
import { memoize } from 'vs/base/common/decorators';

import { DashboardWidget, IDashboardWidget, WidgetConfig, WIDGET_CONFIG } from 'sql/workbench/parts/dashboard/common/dashboardWidget';
import { DashboardServiceInterface } from 'sql/workbench/parts/dashboard/services/dashboardServiceInterface.service';
import { CommonServiceInterface } from 'sql/platform/bootstrap/node/commonServiceInterface.service';
import { IDashboardWebview, IDashboardViewService } from 'sql/platform/dashboard/common/dashboardViewService';

import * as azdata from 'azdata';
import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';
import { WebviewElement } from 'vs/workbench/contrib/webview/electron-browser/webviewElement';

interface IWebviewWidgetConfig {
	id: string;
}

const selector = 'webview-widget';

@Component({
	selector: selector,
	template: '<div></div>'
})
export class WebviewWidget extends DashboardWidget implements IDashboardWidget, OnInit, IDashboardWebview {

	private _id: string;
	private _webview: WebviewElement;
	private _html: string;
	private _onMessage = new Emitter<string>();
	public readonly onMessage: Event<string> = this._onMessage.event;
	private _onMessageDisposable: IDisposable;

	constructor(
		@Inject(forwardRef(() => CommonServiceInterface)) private _dashboardService: DashboardServiceInterface,
		@Inject(WIDGET_CONFIG) protected _config: WidgetConfig,
		@Inject(forwardRef(() => ElementRef)) private _el: ElementRef,
		@Inject(IDashboardViewService) private dashboardViewService: IDashboardViewService,
		@Inject(IInstantiationService) private instantiationService: IInstantiationService,
	) {
		super();
		this._id = (_config.widget[selector] as IWebviewWidgetConfig).id;
	}

	ngOnInit() {
		this.dashboardViewService.registerWebview(this);
		this._createWebview();
	}

	public get id(): string {
		return this._id;
	}

	public setHtml(html: string): void {
		this._html = html;
		if (this._webview) {
			this._webview.html = html;
			this._webview.layout();
		}
	}

	@memoize
	public get connection(): azdata.connection.Connection {
		const currentConnection = this._dashboardService.connectionManagementService.connectionInfo.connectionProfile;
		const connection: azdata.connection.Connection = {
			providerName: currentConnection.providerName,
			connectionId: currentConnection.id,
			options: currentConnection.options
		};
		return connection;
	}

	@memoize
	public get serverInfo(): azdata.ServerInfo {
		return this._dashboardService.connectionManagementService.connectionInfo.serverInfo;
	}

	public layout(): void {
		this._webview.layout();
	}

	public sendMessage(message: string): void {
		if (this._webview) {
			this._webview.sendMessage(message);
		}
	}

	private _createWebview(): void {
		if (this._webview) {
			this._webview.dispose();
		}
		if (this._onMessageDisposable) {
			this._onMessageDisposable.dispose();
		}

		this._webview = this.instantiationService.createInstance(WebviewElement,
			{},
			{
				allowScripts: true,
			});

		this._webview.mountTo(this._el.nativeElement);
		this._onMessageDisposable = this._webview.onMessage(e => {
			this._onMessage.fire(e);
		});
		if (this._html) {
			this._webview.html = this._html;
		}
		this._webview.layout();
	}
}
