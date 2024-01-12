/**
 * @license Copyright (c) 2003-2023, CKSource Holding sp. z o.o. All rights reserved.
 * For licensing, see LICENSE.md or https://ckeditor.com/legal/ckeditor-oss-license
 */

/**
 * @module image/imagetextalternative
 */

import { Plugin } from 'ckeditor5/src/core';
import ImageOCRLatexEditing from './imageocrlatex/imageocrlatexediting';
import ImageOCRLatexUI from './imageocrlatex/imageocrlatexui';

/**
 * The image text alternative plugin.
 *
 * For a detailed overview, check the {@glink features/images/images-styles image styles} documentation.
 *
 * This is a "glue" plugin which loads the
 *  {@link module:image/imagetextalternative/imagetextalternativeediting~ImageTextAlternativeEditing}
 * and {@link module:image/imagetextalternative/imagetextalternativeui~ImageTextAlternativeUI} plugins.
 *
 * @extends module:core/plugin~Plugin
 */
export default class ImageOCRLatex extends Plugin {
	/**
	 * @inheritDoc
	 */
	static get requires() {
		return [ ImageOCRLatexEditing, ImageOCRLatexUI ];
	}

	/**
	 * @inheritDoc
	 */
	static get pluginName() {
		return 'ImageOCRLatex';
	}
}
