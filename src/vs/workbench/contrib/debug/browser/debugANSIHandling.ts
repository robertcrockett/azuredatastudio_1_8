/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { LinkDetector } from 'vs/workbench/contrib/debug/browser/linkDetector';
import { RGBA, Color } from 'vs/base/common/color';

/**
 * @param text The content to stylize.
 * @returns An {@link HTMLSpanElement} that contains the potentially stylized text.
 */
export function handleANSIOutput(text: string, linkDetector: LinkDetector): HTMLSpanElement {

	const root: HTMLSpanElement = document.createElement('span');
	const textLength: number = text.length;

	let styleNames: string[] = [];
	let customFgColor: RGBA | undefined;
	let customBgColor: RGBA | undefined;
	let currentPos: number = 0;
	let buffer: string = '';

	while (currentPos < textLength) {

		let sequenceFound: boolean = false;

		// Potentially an ANSI escape sequence.
		// See http://ascii-table.com/ansi-escape-sequences.php & https://en.wikipedia.org/wiki/ANSI_escape_code
		if (text.charCodeAt(currentPos) === 27 && text.charAt(currentPos + 1) === '[') {

			const startPos: number = currentPos;
			currentPos += 2; // Ignore 'Esc[' as it's in every sequence.

			let ansiSequence: string = '';

			while (currentPos < textLength) {
				const char: string = text.charAt(currentPos);
				ansiSequence += char;

				currentPos++;

				// Look for a known sequence terminating character.
				if (char.match(/^[ABCDHIJKfhmpsu]$/)) {
					sequenceFound = true;
					break;
				}

			}

			if (sequenceFound) {

				// Flush buffer with previous styles.
				appendStylizedStringToContainer(root, buffer, styleNames, linkDetector, customFgColor, customBgColor);

				buffer = '';

				/*
				 * Certain ranges that are matched here do not contain real graphics rendition sequences. For
				 * the sake of having a simpler expression, they have been included anyway.
				 */
				if (ansiSequence.match(/^(?:[34][0-8]|9[0-7]|10[0-7]|[013]|4|[34]9)(?:;[349][0-7]|10[0-7]|[013]|[245]|[34]9)?(?:;[012]?[0-9]?[0-9])*;?m$/)) {

					const styleCodes: number[] = ansiSequence.slice(0, -1) // Remove final 'm' character.
						.split(';')										   // Separate style codes.
						.filter(elem => elem !== '')			           // Filter empty elems as '34;m' -> ['34', ''].
						.map(elem => parseInt(elem, 10));		           // Convert to numbers.

					if (styleCodes[0] === 38 || styleCodes[0] === 48) {
						// Advanced color code - can't be combined with formatting codes like simple colors can
						// Ignores invalid colors and additional info beyond what is necessary
						const colorType = (styleCodes[0] === 38) ? 'foreground' : 'background';

						if (styleCodes[1] === 5) {
							set8BitColor(styleCodes, colorType);
						} else if (styleCodes[1] === 2) {
							set24BitColor(styleCodes, colorType);
						}
					} else {
						setBasicFormatters(styleCodes);
					}

				} else {
					// Unsupported sequence so simply hide it.
				}

			} else {
				currentPos = startPos;
			}
		}

		if (sequenceFound === false) {
			buffer += text.charAt(currentPos);
			currentPos++;
		}
	}

	// Flush remaining text buffer if not empty.
	if (buffer) {
		appendStylizedStringToContainer(root, buffer, styleNames, linkDetector, customFgColor, customBgColor);
	}

	return root;

	/**
	 * Change the foreground or background color by clearing the current color
	 * and adding the new one.
	 * @param newClass If string or number, new class will be
	 *  `code-(foreground or background)-newClass`. If `undefined`, no new class
	 * 	will be added.
	 * @param colorType If `'foreground'`, will change the foreground color, if
	 * 	`'background'`, will change the background color.
	 * @param customColor If provided, this custom color will be used instead of
	 * 	a class-defined color.
	 */
	function changeColor(newClass: string | number | undefined, colorType: 'foreground' | 'background', customColor?: RGBA): void {
		styleNames = styleNames.filter(style => !style.match(new RegExp(`^code-${colorType}-(\\d+|custom)$`)));
		if (newClass) {
			styleNames.push(`code-${colorType}-${newClass}`);
		}
		if (colorType === 'foreground') {
			customFgColor = customColor;
		} else {
			customBgColor = customColor;
		}
	}

	/**
	 * Calculate and set basic ANSI formatting. Supports bold, italic, underline,
	 * normal foreground and background colors, and bright foreground and
	 * background colors. Not to be used for codes containing advanced colors.
	 * Will ignore invalid codes.
	 * @param styleCodes Array of ANSI basic styling numbers, which will be
	 * applied in order. New colors and backgrounds clear old ones; new formatting
	 * does not.
	 * @see {@link https://en.wikipedia.org/wiki/ANSI_escape_code }
	 */
	function setBasicFormatters(styleCodes: number[]): void {
		for (let code of styleCodes) {
			if (code === 0) {
				styleNames = [];
			} else if (code === 1) {
				styleNames.push('code-bold');
			} else if (code === 3) {
				styleNames.push('code-italic');
			} else if (code === 4) {
				styleNames.push('code-underline');
			} else if ((code >= 30 && code <= 37) || (code >= 90 && code <= 97)) {
				changeColor(code, 'foreground');
			} else if ((code >= 40 && code <= 47) || (code >= 100 && code <= 107)) {
				changeColor(code, 'background');
			} else if (code === 39) {
				changeColor(undefined, 'foreground');
			} else if (code === 49) {
				changeColor(undefined, 'background');
			}
		}
	}

	/**
	 * Calculate and set styling for complicated 24-bit ANSI color codes.
	 * @param styleCodes Full list of integer codes that make up the full ANSI
	 * sequence, including the two defining codes and the three RGB codes.
	 * @param colorType If `'foreground'`, will set foreground color, if
	 * `'background'`, will set background color.
	 * @see {@link https://en.wikipedia.org/wiki/ANSI_escape_code#24-bit }
	 */
	function set24BitColor(styleCodes: number[], colorType: 'foreground' | 'background'): void {
		if (styleCodes.length >= 5 &&
			styleCodes[2] >= 0 && styleCodes[2] <= 255 &&
			styleCodes[3] >= 0 && styleCodes[3] <= 255 &&
			styleCodes[4] >= 0 && styleCodes[4] <= 255) {
			const customColor = new RGBA(styleCodes[2], styleCodes[3], styleCodes[4]);
			changeColor('custom', colorType, customColor);
		}
	}

	/**
	 * Calculate and set styling for advanced 8-bit ANSI color codes.
	 * @param styleCodes Full list of integer codes that make up the ANSI
	 * sequence, including the two defining codes and the one color code.
	 * @param colorType If `'foreground'`, will set foreground color, if
	 * `'background'`, will set background color.
	 * @see {@link https://en.wikipedia.org/wiki/ANSI_escape_code#8-bit }
	 */
	function set8BitColor(styleCodes: number[], colorType: 'foreground' | 'background'): void {
		let colorNumber = styleCodes[2];
		const color = calcANSI8bitColor(colorNumber);

		if (color) {
			changeColor('custom', colorType, color);
		} else if (colorNumber >= 0 && colorNumber <= 15) {
			// Need to map to one of the four basic color ranges (30-37, 90-97, 40-47, 100-107)
			colorNumber += 30;
			if (colorNumber >= 38) {
				// Bright colors
				colorNumber += 52;
			}
			if (colorType === 'background') {
				colorNumber += 10;
			}
			changeColor(colorNumber, colorType);
		}
	}
}

/**
 * @param root The {@link HTMLElement} to append the content to.
 * @param stringContent The text content to be appended.
 * @param cssClasses The list of CSS styles to apply to the text content.
 * @param linkDetector The {@link LinkDetector} responsible for generating links from {@param stringContent}.
 * @param customTextColor If provided, will apply custom color with inline style.
 * @param customBackgroundColor If provided, will apply custom color with inline style.
 */
export function appendStylizedStringToContainer(
	root: HTMLElement,
	stringContent: string,
	cssClasses: string[],
	linkDetector: LinkDetector,
	customTextColor?: RGBA,
	customBackgroundColor?: RGBA
): void {
	if (!root || !stringContent) {
		return;
	}

	const container = linkDetector.handleLinks(stringContent);

	container.className = cssClasses.join(' ');
	if (customTextColor) {
		container.style.color =
			Color.Format.CSS.formatRGB(new Color(customTextColor));
	}
	if (customBackgroundColor) {
		container.style.backgroundColor =
			Color.Format.CSS.formatRGB(new Color(customBackgroundColor));
	}

	root.appendChild(container);
}

/**
 * Calculate the color from the color set defined in the ANSI 8-bit standard.
 * Standard and high intensity colors are not defined in the standard as specific
 * colors, so these and invalid colors return `undefined`.
 * @see {@link https://en.wikipedia.org/wiki/ANSI_escape_code#8-bit } for info.
 * @param colorNumber The number (ranging from 16 to 255) referring to the color
 * desired.
 */
export function calcANSI8bitColor(colorNumber: number): RGBA | undefined {
	if (colorNumber % 1 !== 0) {
		// Should be integer
		// {{SQL CARBON EDIT}} @todo anthonydresser 4/12/19 this is necessary because we don't use strict null checks
		return undefined;
	} if (colorNumber >= 16 && colorNumber <= 231) {
		// Converts to one of 216 RGB colors
		colorNumber -= 16;

		let blue: number = colorNumber % 6;
		colorNumber = (colorNumber - blue) / 6;
		let green: number = colorNumber % 6;
		colorNumber = (colorNumber - green) / 6;
		let red: number = colorNumber;

		// red, green, blue now range on [0, 5], need to map to [0,255]
		const convFactor: number = 255 / 5;
		blue = Math.round(blue * convFactor);
		green = Math.round(green * convFactor);
		red = Math.round(red * convFactor);

		return new RGBA(red, green, blue);
	} else if (colorNumber >= 232 && colorNumber <= 255) {
		// Converts to a grayscale value
		colorNumber -= 232;
		const colorLevel: number = Math.round(colorNumber / 23 * 255);
		return new RGBA(colorLevel, colorLevel, colorLevel);
	} else {
		// {{SQL CARBON EDIT}} @todo anthonydresser 4/12/19 this is necessary because we don't use strict null checks
		return undefined;
	}
}
