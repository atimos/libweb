'use strict';

import {array as dom_array} from './collection';

export function node(node) {
	Array.prototype.forEach.call(node.childNodes, child => {
		node.parentNode.removeChild(child);
	});
}

export function selector(selector, parent = window.document) {
	dom_array(selector, parent)
		.forEach(node => {
			node.parentNode.removeChild(node);
		});
}

