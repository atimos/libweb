'use strict';

export function list_item(tpl, data) {
	var element = tpl.content.cloneNode(true).firstElementChild;

	let value;
	if ( element.dataset.value !== undefined ) {
		value = data[element.dataset.value];
		delete element.dataset.value;
	} else if ( data.value !== undefined ) {
		value = data.value;
	}

	//TODO: serilize non-string objects
	if ( value !== undefined ) {
		element.value = data.value;
	}
	
	Array.prototype.forEach.call(element.querySelectorAll('[data-key]'), function(node) {
		node.dataset.key.split('|').some(function(key) {
			if ( data[key] !== undefined ) {
				node.textContent = data[key];
				return true;
			}
		});

		delete node.dataset.key;
	});

	return element;
}
