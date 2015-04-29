'use strict';

import {node_list} from './collection';

let events = Object.getOwnPropertyNames(document)
	.concat(Object.getOwnPropertyNames(Object.getPrototypeOf(Object.getPrototypeOf(document))))
	.concat(Object.getOwnPropertyNames(Object.getPrototypeOf(window)))
	.filter((attribute, index, list) => {
		return !attribute.indexOf('on') &&
			( document[attribute] === null || typeof document[attribute] === 'function' ) &&
			list.indexOf(attribute) == index;
	})
	.map(item => {
		return item.toLowerCase();
	});

export default function(tpl, data) {
	let node = tpl.content.cloneNode(true);

	node_list(node.children)
		.forEach(node => {
			for ( let name in data ) {
				if ( node.dataset.tplRel === name ) {
					if ( Array.isArray(data[name]) ) {
						render_list(node, data[name]);
					} else {
						render_node(node, data[name]);
					}
				}
			}
		});

	return node;
}

function render_node(node, data) {
	if ( node !== null ) {
		let tpl = null;

		if ( node.nodeName.toLowerCase() === 'template' ) {
			tpl = node;
			node = node.content.cloneNode(true);
		}

		delete node.dataset.tplRel;

		if ( data.children === undefined ) {
			set_attributes_all(node, data.value);
			set_value(node, data.value);
		} else {
			set_attributes(node, data.value);

			for ( let name in data.children ) {
				if ( Array.isArray(data.children[name]) ) {
					render_list(node.querySelector(':scope > [data-tpl-rel="' + name + '"]'), data.children[name]);
				} else {
					render_node(node.querySelector(':scope > [data-tpl-rel="' + name + '"]'), data.children[name]);
				}
			}
		}

		if ( tpl !== null ) {
			if ( tpl.nextSibling === undefined ) {
				tpl.parentNode.appendChild(node);
			} else {
				tpl.insertBefore(node, tpl.nextSibling);
			}
		}
	}
}

function render_list(node, data) {
	if ( node !== null ) {
		let node_list = document.createDocumentFragment();

		data.forEach(item => {
			let _node = node.cloneNode(true);

			render_node(_node, item);

			node_list.appendChild(_node);
		});

		node.parentNode.replaceChild(node_list, node);
	}
}

function set_attributes_all(node, attr) {
	let tmp = document.createDocumentFragment();
	tmp.appendChild(node);

	Array.prototype.forEach.call(tmp.querySelectorAll('[data-tpl-attr]'), node => {
		set_attributes(node, attr);
	});

	tmp.removeChild(tmp.children[0]);
}

function set_attributes(node, data) {
	if ( node.dataset.tplAttr !== undefined ) {
		node.dataset.tplAttr.split(',').forEach(attribute => {
			let [attr_name, data_name] = attribute.split(':')
					.map(item => {
						return item.trim();
					}),
				value = data[data_name||attr_name];

			switch ( typeof value ) {
				case 'undefined':
					value = '';
					break;
				case 'boolean':
					value = data_name||attr_name;
					break;
			}

			value = value.toString();

			if ( events.indexOf(name.toLowerCase()) === -1 && value.match(/^javascript:/i) === null ) {
				node.setAttribute(attr_name, value);
			}
		});

		delete node.dataset.tplAttr;
	}
}

function set_value(node, value) {
	let tmp = document.createDocumentFragment();
	tmp.appendChild(node);

	Array.prototype.forEach.call(tmp.querySelectorAll('[data-tpl-val]'), node => {
		node.dataset.tplVal.split('|')
			.some(content => {
				content = content.trim();

				if ( value[content] !== undefined ) {
					node.textContent = value[content];
					return true;
				}
			});

		delete node.dataset.tplVal;
	});

	tmp.removeChild(tmp.children[0]);
}
