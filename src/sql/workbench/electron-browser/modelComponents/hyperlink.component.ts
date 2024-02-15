/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import {
	Component, Input, Inject, ChangeDetectorRef, forwardRef,
	OnDestroy, AfterViewInit, ElementRef
} from '@angular/core';

import * as azdata from 'azdata';

import { ComponentBase } from 'sql/workbench/electron-browser/modelComponents/componentBase';
import { IComponent, IComponentDescriptor, IModelStore } from 'sql/workbench/electron-browser/modelComponents/interfaces';

@Component({
	selector: 'modelview-hyperlink',
	template: `<a [href]="getUrl()" target="blank">{{getLabel()}}</a>`
})
export default class HyperlinkComponent extends ComponentBase implements IComponent, OnDestroy, AfterViewInit {
	@Input() descriptor: IComponentDescriptor;
	@Input() modelStore: IModelStore;

	constructor(
		@Inject(forwardRef(() => ChangeDetectorRef)) changeRef: ChangeDetectorRef,
		@Inject(forwardRef(() => ElementRef)) el: ElementRef) {
		super(changeRef, el);
	}

	ngOnInit(): void {
		this.baseInit();
	}

	ngAfterViewInit(): void {
	}

	ngOnDestroy(): void {
		this.baseDestroy();
	}

	public setLayout(layout: any): void {
		this.layout();
	}

	public set label(newValue: string) {
		this.setPropertyFromUI<azdata.HyperlinkComponentProperties, string>((properties, value) => { properties.label = value; }, newValue);
	}

	public get label(): string {
		return this.getPropertyOrDefault<azdata.HyperlinkComponentProperties, string>((props) => props.label, '');
	}

	public getLabel(): string {
		return this.label;
	}

	public set url(newValue: string) {
		this.setPropertyFromUI<azdata.HyperlinkComponentProperties, string>((properties, value) => { properties.url = value; }, newValue);
	}

	public get url(): string {
		return this.getPropertyOrDefault<azdata.HyperlinkComponentProperties, string>((props) => props.url, '');
	}

	public getUrl(): string {
		return this.url;
	}
}
