/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { ChartInsight } from 'sql/workbench/parts/dashboard/widgets/insights/views/charts/chartInsight.component';
import { mixin } from 'sql/base/common/objects';
import { ChartType, IChartConfig, customMixin } from 'sql/workbench/parts/dashboard/widgets/insights/views/charts/interfaces';

import * as colors from 'vs/platform/theme/common/colorRegistry';
import { editorLineNumbers } from 'vs/editor/common/view/editorColorRegistry';
import { ChangeDetectorRef, Inject, forwardRef } from '@angular/core';
import { ITelemetryService } from 'vs/platform/telemetry/common/telemetry';
import { IThemeService, ITheme } from 'vs/platform/theme/common/themeService';
import { ILogService } from 'vs/platform/log/common/log';

export interface IBarChartConfig extends IChartConfig {
	yAxisMin: number;
	yAxisMax: number;
	yAxisLabel: string;
	xAxisMin: number;
	xAxisMax: number;
	xAxisLabel: string;
}

export default class BarChart extends ChartInsight {
	protected readonly chartType: ChartType = ChartType.Bar;

	constructor(
		@Inject(forwardRef(() => ChangeDetectorRef)) _changeRef: ChangeDetectorRef,
		@Inject(IThemeService) themeService: IThemeService,
		@Inject(ITelemetryService) telemetryService: ITelemetryService,
		@Inject(ILogService) logService: ILogService
	) {
		super(_changeRef, themeService, telemetryService, logService);
	}

	public setConfig(config: IBarChartConfig): void {
		let options = {};
		if (config.xAxisMax) {
			const opts = {
				scales: {
					xAxes: [{
						display: true,
						ticks: {
							max: config.xAxisMax
						}
					}]
				}
			};
			options = mixin({}, mixin(options, opts, true, customMixin));
		}

		if (config.xAxisMin) {
			const opts = {
				scales: {
					xAxes: [{
						display: true,
						ticks: {
							min: config.xAxisMin
						}
					}]
				}
			};
			options = mixin({}, mixin(options, opts, true, customMixin));
		}

		if (config.xAxisLabel) {
			const opts = {
				scales: {
					xAxes: [{
						display: true,
						scaleLabel: {
							display: true,
							labelString: config.xAxisLabel
						}
					}]
				}
			};
			options = mixin({}, mixin(options, opts, true, customMixin));
		}

		if (config.yAxisMax) {
			const opts = {
				scales: {
					yAxes: [{
						display: true,
						ticks: {
							max: config.yAxisMax
						}
					}]
				}
			};
			options = mixin({}, mixin(options, opts, true, customMixin));
		}

		if (config.yAxisMin) {
			const opts = {
				scales: {
					yAxes: [{
						display: true,
						ticks: {
							min: config.yAxisMin
						}
					}]
				}
			};
			options = mixin({}, mixin(options, opts, true, customMixin));
		}

		if (config.yAxisLabel) {
			const opts = {
				scales: {
					yAxes: [{
						display: true,
						scaleLabel: {
							display: true,
							labelString: config.yAxisLabel
						}
					}]
				}
			};
			options = mixin({}, mixin(options, opts, true, customMixin));
		}

		this.options = mixin({}, mixin(this.options, options, true, customMixin));
		super.setConfig(config);
	}

	protected updateTheme(e: ITheme): void {
		super.updateTheme(e);
		const foregroundColor = e.getColor(colors.editorForeground);
		const foreground = foregroundColor ? foregroundColor.toString() : null;
		const gridLinesColor = e.getColor(editorLineNumbers);
		const gridLines = gridLinesColor ? gridLinesColor.toString() : null;
		const options = {
			scales: {
				xAxes: [{
					scaleLabel: {
						fontColor: foreground
					},
					ticks: {
						fontColor: foreground
					},
					gridLines: {
						color: gridLines
					}
				}],
				yAxes: [{
					scaleLabel: {
						fontColor: foreground
					},
					ticks: {
						fontColor: foreground
					},
					gridLines: {
						color: gridLines
					}
				}]
			}
		};

		this.options = mixin({}, mixin(this.options, options, true, customMixin));
	}
}
