'use strict';

import {selector as selector_, node_list} from './collection';

export function node(node) {
	node_list(node.childNodes)
		.forEach(child => {
			node.parentNode.removeChild(child);
		});
}

export function selector(query, parent = window.document) {
	selector_(query, parent)
		.forEach(node => {
			node.parentNode.removeChild(node);
		});
}

