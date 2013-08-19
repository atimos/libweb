(function(window, document) {
	'use strict';

	var elements = document.querySelectorAll('template'), templates = {}, i, ii, element, fragment, template;

	for ( i = elements.length - 1; i > -1; i -= 1 ) {
		element = elements[i];

		if ( element.content ) {
			template = element.content.cloneNode(true);
		}

		if ( !template || template.childNodes.length === 0 ) {
			fragment = document.createDocumentFragment();

			for ( ii = 0; ii < element.childNodes.length; ii++ ) {
				fragment.appendChild(element.childNodes[ii].cloneNode(true));
			}

			template = fragment.cloneNode(true);
		}

		templates[element.id] = template;

		element.parentNode.removeChild(element);
	}

	window.lib = window.lib || {};
	window.lib.ui = window.lib.ui || {};
	window.lib.ui.template = function(name) {
		if ( templates[name] ) {
			return templates[name].cloneNode(true);
		}
		return null;
	};
}(window, window.document, void(0)));
