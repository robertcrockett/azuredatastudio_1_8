/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import BarChart from './barChart.component';
import { ChartType } from 'sql/workbench/parts/dashboard/widgets/insights/views/charts/interfaces';
import { forwardRef, Inject, ChangeDetectorRef } from '@angular/core';
import { ITelemetryService } from 'vs/platform/telemetry/common/telemetry';
import { IThemeService } from 'vs/platform/theme/common/themeService';
import { ILogService } from 'vs/platform/log/common/log';

export default class HorizontalBarChart extends BarChart {
	protected readonly chartType: ChartType = ChartType.HorizontalBar;

	constructor(
		@Inject(forwardRef(() => ChangeDetectorRef)) _changeRef: ChangeDetectorRef,
		@Inject(IThemeService) themeService: IThemeService,
		@Inject(ITelemetryService) telemetryService: ITelemetryService,
		@Inject(ILogService) logService: ILogService
	) {
		super(_changeRef, themeService, telemetryService, logService);
	}
}
