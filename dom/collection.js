'use strict';
let lunr = require('../lib/lunr.js/lunr.js');
export function array(query, element) {
	if ( element === undefined ) {
		element = window.document;
	}
	return Array.prototype.slice.call(element.querySelectorAll(query));
}

export function collection_map(query, key, element) {
	return array(query, element)
		.reduce((map, item) => {
			if ( item.hasAttribute(key) ) {
				map.set(item.getAttribute(key), item);
			}
			return map;
		}, new Map());
}

