/**
 * @license Copyright (c) 2003-2023, CKSource Holding sp. z o.o. All rights reserved.
 * For licensing, see LICENSE.md or https://ckeditor.com/legal/ckeditor-oss-license
 */

/**
 * @module image/imagetextalternative/imagetextalternativeui
 */

import { Plugin, icons } from 'ckeditor5/src/core';
import { ButtonView, ContextualBalloon, clickOutsideHandler } from 'ckeditor5/src/ui';

import TextAlternativeFormView from './ui/textocrlatexformview';
import { repositionContextualBalloon, getBalloonPositionData } from '../image/ui/utils';

/**
 * The image text alternative UI plugin.
 *
 * The plugin uses the {@link module:ui/panel/balloon/contextualballoon~ContextualBalloon}.
 *
 * @extends module:core/plugin~Plugin
 */
export default class ImageOCRLatexUI extends Plugin {
	/**
	 * @inheritDoc
	 */
	static get requires() {
		return [ ContextualBalloon ];
	}

	/**
	 * @inheritDoc
	 */
	static get pluginName() {
		return 'ImageOCRLatexUI';
	}

	/**
	 * @inheritDoc
	 */
	init() {
		this._createButton();
	}

	/**
	 * @inheritDoc
	 */
	destroy() {
		super.destroy();

		// Destroy created UI components as they are not automatically destroyed (see ckeditor5#1341).
		if ( this._form ) {
			this._form.destroy();
		}
	}

	/**
	 * Creates a button showing the balloon panel for changing the image text alternative and
	 * registers it in the editor {@link module:ui/componentfactory~ComponentFactory ComponentFactory}.
	 *
	 * @private
	 */
	_createButton() {
		const editor = this.editor;
		const t = editor.t;

		editor.ui.componentFactory.add( 'imageOCRLatex', locale => {
			const command = editor.commands.get( 'imageOCRLatex' );
			const view = new ButtonView( locale );

			view.set( {
				label: t( 'Change image text alternative' ),
				icon: icons.eraser,
				tooltip: true
			} );

			view.bind( 'isEnabled' ).to( command, 'isEnabled' );
			view.bind( 'isOn' ).to( command, 'value', value => !!value );

			this.listenTo( view, 'execute', () => {
				this._showForm();
			} );

			return view;
		} );
	}

	/**
	 * Creates the {@link module:image/imageOCRLatex/ui/textalternativeformview~TextAlternativeFormView}
	 * form.
	 *
	 * @private
	 */
	_createForm() {
		const editor = this.editor;
		const view = editor.editing.view;
		const viewDocument = view.document;
		const imageUtils = editor.plugins.get( 'ImageUtils' );

		/**
		 * The contextual balloon plugin instance.
		 *
		 * @private
		 * @member {module:ui/panel/balloon/contextualballoon~ContextualBalloon}
		 */
		this._balloon = this.editor.plugins.get( 'ContextualBalloon' );

		/**
		 * A form containing a textarea and buttons, used to change the `alt` text value.
		 *
		 * @member {module:image/imagetextalternative/ui/textalternativeformview~TextAlternativeFormView}
		 */
		this._form = new TextAlternativeFormView( editor.locale );

		// Render the form so its #element is available for clickOutsideHandler.
		this._form.render();

		this.listenTo( this._form, 'submit', () => {
			editor.execute( 'imageOCRLatex', {
				newValue: this._form.labeledInput.fieldView.element.value
			} );

			this._hideForm( true );
		} );

		this.listenTo( this._form, 'cancel', () => {
			this._hideForm( true );
		} );

		// Close the form on Esc key press.
		this._form.keystrokes.set( 'Esc', ( data, cancel ) => {
			this._hideForm( true );
			cancel();
		} );

		// Reposition the balloon or hide the form if an image widget is no longer selected.
		this.listenTo( editor.ui, 'update', () => {
			if ( !imageUtils.getClosestSelectedImageWidget( viewDocument.selection ) ) {
				this._hideForm( true );
			} else if ( this._isVisible ) {
				repositionContextualBalloon( editor );
			}
		} );

		// Close on click outside of balloon panel element.
		clickOutsideHandler( {
			emitter: this._form,
			activator: () => this._isVisible,
			contextElements: () => [ this._balloon.view.element ],
			callback: () => this._hideForm()
		} );
	}

	/**
	 * Shows the {@link #_form} in the {@link #_balloon}.
	 *
	 * @private
	 */
	_showForm() {
		if ( this._isVisible ) {
			return;
		}

		if ( !this._form ) {
			this._createForm();
		}

		const editor = this.editor;
		const command = editor.commands.get( 'imageOCRLatex' );
		const labeledInput = this._form.labeledInput;
		const imgUrl = command.value;

		this._downloadImage( imgUrl )
			.then( blob => {
			// Create FormData and append the Blob
				// eslint-disable-next-line no-undef
				const formData = new FormData();
				formData.append( 'file', blob, 'image.jpg' );

				// Send FormData to the server
				this._sendFormData( formData )
					.then( data => {
						this._form.disableCssTransitions();

						if ( !this._isInBalloon ) {
							this._balloon.add( {
								view: this._form,
								position: getBalloonPositionData( editor )
							} );
						}

						const latexes = data.latex_maths.data;

						let result = data.math_text.data;
						// eslint-disable-next-line prefer-const
						for ( let latex of [ ...new Set( latexes ) ] ) {
							result = result.replaceAll( latex, `<span class="math-tex">${ latex }</span>` );
						}

						result = `<p>${ result }</p>`;
						const labeledFieldView = labeledInput.fieldView.element.closest( '.ck-labeled-field-view' );
						// eslint-disable-next-line no-undef
						const elements = window.document.getElementsByClassName( 'ck-labeled-field-view-math-preview' );
						if ( labeledFieldView ) {
							let newElement = elements[ 0 ];
							if ( !newElement ) {
								// eslint-disable-next-line no-undef
								newElement = window.document.createElement( 'p' );
								newElement.className = 'ck-labeled-field-view-math-preview';
							}

							newElement.innerHTML = result;
							labeledFieldView.append( newElement );
							// eslint-disable-next-line no-undef
							window.MathJax.typeset( [ newElement ] );
						}

						// Make sure that each time the panel shows up, the field remains in sync with the value of
						// the command. If the user typed in the input, then canceled the balloon (`labeledInput#value`
						// stays unaltered) and re-opened it without changing the value of the command, they would see the
						// old value instead of the actual value of the command.
						// https://github.com/ckeditor/ckeditor5-image/issues/114
						labeledInput.fieldView.value = labeledInput.fieldView.element.value = result || '';
						this._form.labeledInput.fieldView.select();

						this._form.enableCssTransitions();
					} )
					.catch( error => {
						// eslint-disable-next-line no-alert, no-undef
						window.alert( error );
					} );
			} )
			.catch( error => {
				// eslint-disable-next-line no-alert, no-undef
				window.alert( error );
			} );
	}

	/**
	 * Removes the {@link #_form} from the {@link #_balloon}.
	 *
	 * @param {Boolean} [focusEditable=false] Controls whether the editing view is focused afterwards.
	 * @private
	 */
	_hideForm( focusEditable ) {
		if ( !this._isInBalloon ) {
			return;
		}

		// Blur the input element before removing it from DOM to prevent issues in some browsers.
		// See https://github.com/ckeditor/ckeditor5/issues/1501.
		if ( this._form.focusTracker.isFocused ) {
			this._form.saveButtonView.focus();
		}

		this._balloon.remove( this._form );

		if ( focusEditable ) {
			this.editor.editing.view.focus();
		}
	}

	async _downloadImage( url ) {
		// eslint-disable-next-line no-undef
		const response = await fetch( url );
		if ( !response.ok ) {
			// eslint-disable-next-line no-alert, no-undef
			throw new Error( ` Error downloading image. Status: ${ response.status } ` );
		}
		return await response.blob();
	}

	_sendFormData( formData ) {
		// eslint-disable-next-line no-undef
		return fetch( 'https://internal-quizz.giainhanh.io/api/paper-exams/ocr-image', { method: 'POST', body: formData } )
			.then( response => {
				if ( !response.ok ) {
					return response.json().then( errorData => {
						throw new Error( `HTTP error! Status: ${ response.status }, Message: ${ errorData.detail }` );
					} );
				}
				return response.json();
			} )
			.then( data => data )
			.catch( error => {
				// eslint-disable-next-line no-alert, no-undef
				throw new Error( error );
			} );
	}

	/**
	 * Returns `true` when the {@link #_form} is the visible view in the {@link #_balloon}.
	 *
	 * @private
	 * @type {Boolean}
	 */
	get _isVisible() {
		return !!this._balloon && this._balloon.visibleView === this._form;
	}

	/**
	 * Returns `true` when the {@link #_form} is in the {@link #_balloon}.
	 *
	 * @private
	 * @type {Boolean}
	 */
	get _isInBalloon() {
		return !!this._balloon && this._balloon.hasView( this._form );
	}
}
