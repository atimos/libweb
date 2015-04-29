'use strict';

import {node_list} from './collection';

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

			node.setAttribute(attr_name, secure_attribute(attr_name, value, node));
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

function secure_attribute(name, value, node) {
	value = value.toString();

	let matched_events = Object.getOwnPropertyNames(node)
		.concat(Object.getOwnPropertyNames(Object.getPrototypeOf(Object.getPrototypeOf(node))))
		.concat(Object.getOwnPropertyNames(Object.getPrototypeOf(node)))
		.filter(function(attribute){
			return attribute.indexOf('on') === 0 &&
				(node[attribute] === null || typeof node[attribute] === 'function') &&
				attribute.toLowerCase() === name.toLowerCase();
		});
	
	if ( matched_events.length > 0 || value.match(/^javascript:/i) !== null ) {
		return '';
	}

	return value;
}
