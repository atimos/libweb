'use strict';

import {node_list as node_list_array} from './collection';

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

	node_list_array(node.children)
		.forEach(node => {
			let name = node.dataset.tplRel;

			if ( data.hasOwnProperty(name) ) {
				if ( Array.isArray(data[name]) ) {
					render_list(node, data[name]);
				} else {
					render_node(node, data[name]);
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

		if ( data.children === undefined ) {
			set_attributes_all(node, data.value);
			set_value(node, data.value);
		} else {
			set_attributes(node, data.value);

			Object.keys(data.children)
				.forEach(name => {
					if ( Array.isArray(data.children[name]) ) {
						render_list(node.querySelector(':scope > [data-tpl-rel="' + name + '"]'), data.children[name]);
					} else {
						render_node(node.querySelector(':scope > [data-tpl-rel="' + name + '"]'), data.children[name]);
					}
				});
		}

		delete node.dataset.tplRel;

		if ( tpl !== null ) {
			if ( tpl.nextSibling === undefined ) {
				tpl.parentNode.appendChild(node);
			} else {
				tpl.parentNode.insertBefore(node, tpl.nextSibling);
			}
		}
	}
}

function render_list(node, data) {
	if ( node !== null ) {
		let node_list = document.createDocumentFragment(),
			tpl = null;

		if ( node.nodeName.toLowerCase() === 'template' ) {
			tpl = node;
			node = node.content;
		}

		data.forEach(item => {
			if ( tpl === null ) {
				let _node = node.cloneNode(true);

				render_node(_node, item);

				node_list.appendChild(_node);
			} else if ( item.tpl !== undefined ) {
				node_list_array(node.children)
					.some(node => {
						if ( node.dataset.tplRel === item.tpl ) {
							let _node = node.cloneNode(true);

							render_node(_node, item);

							node_list.appendChild(_node);

							return true;
						}
					});
			}
		});

		if ( tpl === null ) {
			node.parentNode.replaceChild(node_list, node);
		} else {
			if ( tpl.nextSibling === undefined ) {
				tpl.parentNode.appendChild(node_list);
			} else {
				tpl.parentNode.insertBefore(node_list, tpl.nextSibling);
			}
		}
	}
}

function set_attributes_all(node, attr) {
	if ( node.dataset.tplAttr !== undefined ) {
		set_attributes(node, attr);
	}

	Array.prototype.forEach.call(node.querySelectorAll('[data-tpl-attr]'), node => {
		set_attributes(node, attr);
	});
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
				if ( attr_name === 'value' && node.nodeName === 'TEXTAREA' ) {
					node[attr_name] = value;
				} else {
					node.setAttribute(attr_name, value);
				}
			}
		});

		delete node.dataset.tplAttr;
	}
}

function set_value(node, value) {
	if ( node.dataset.tplVal !== undefined ) {
		set_attributes(node, value);
		delete node.dataset.tplVal;
	}

	Array.prototype.forEach.call(node.querySelectorAll('[data-tpl-val]'), node => {
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
}
