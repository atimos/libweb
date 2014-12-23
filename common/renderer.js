'use strict';

export function item(node, data) {
	Array.prototype.forEach.call(node.querySelectorAll('[data-key]'), function(node) {
		node.dataset.key.split('|').some(function(key) {
			if ( data[key] !== undefined ) {
				node.textContent = data[key];
				return true;
			}
		});

		delete node.dataset.key;
	});
	return node;
}
