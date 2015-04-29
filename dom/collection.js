'use strict';

export function selector(query, element) {
	if ( element === undefined ) {
		element = window.document;
	}
	return node_list(element.querySelectorAll(query));
}

export function node_list(list) {
	return Array.prototype.slice.call(list);
}
