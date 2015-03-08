'use strict';

import LwMap from '../lwmap/lwmap';

export function array(query, element) {
	if ( element === undefined ) {
		element = window.document;
	}
	return Array.prototype.slice.call(element.querySelectorAll(query));
}

export function collection_object(query, key, element) {
	return array(query, element)
		.reduce((object, item) => {
			if ( item.hasAttribute(key) ) {
				object[item.getAttribute(key)] = item;
			}
			return object;
		}, {});
}

export function collection_map(query, key, element) {
	return array(query, element)
		.reduce((map, item) => {
			if ( item.hasAttribute(key) ) {
				map.set(item.getAttribute(key), item);
			}
			return map;
		}, new LwMap());
}

