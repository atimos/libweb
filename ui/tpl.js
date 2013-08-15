(function() {
	'use strict';

	let elements = document.querySelectorAll('template'), templates = {};

	function getTemplate(template) {
		let fragment = document.createDocumentFragment();

		for ( let i =  0; i < template.childNodes.length; i += 1 ) {
			fragment.appendChild(template.childNodes[i].cloneNode(true));
		}
		template.parentNode.removeChild(template);
		return fragment;
	}

	for ( let i = elements.length - 1; i > -1; i -= 1 ) {
		let element = elements[i];
		templates[element.id] = getTemplate(element);
	}
	window.tmail = window.tmail || {};
	window.tmail.tpl = templates;
}(window, window.document, void(0)));
