'use strict';

import {selector as clear_selector} from '../../dom/clear';
import {selector as collection_selector} from '../../dom/collection';
import render_tpl from '../../dom/render';

let _options = Symbol('options'),
	_items = Symbol('items'),
	self_document = window.document.currentScript.ownerDocument;

class LwDataList extends window.HTMLDataListElement {
	set options(items) {
		clear(this);

		this[_items] = items;
		render(this);
	}

	get options() {
		return undefined;
	}

	get value() {
		let value;

		this[_options]
			.some((item, index) => {
				if ( item.classList.contains('selected') ) {
					value = item.getAttribute('value');

					if ( value === null ) {
						value = this[_items][index];
					}

					return true;
				}
			});

		return value;
	}

	get length() {
		return this[_options].length;
	}

	clear() {
		clear(this);
	}

	next() {
		select_option(this, 1);
	}

	previous() {
		select_option(this, -1);
	}

	next_group() {
		select_option(this, 1, true);
	}

	previous_group() {
		select_option(this, -1, true);
	}

	createdCallback() {
		clear(this);
		this.addEventListener('keydown', keydown_event.bind(this));
	}

	attachedCallback() {
		render(this);
	}
}

function keydown_event(evt) {
	let key = evt.key, dl = this;

	if ( evt.keyCode === 9 && evt.shiftKey ) {
		dl.previous_group();
	} else if ( key === 'Tab' ) {
		dl.next_group();
	} else if ( key === 'ArrowUp' ) {
		dl.previous();
	} else if ( key === 'ArrowDown' ) {
		dl.next();
	} else if ( key === 'Escape' ) {
		clear(dl);
	} else if ( key === 'Enter' && dl.value !== undefined ) {
		let result = {detail: {value: dl.value}};
		clear(dl);
		dl.dispatchEvent(new CustomEvent('select', result));
	}
}

function render(dl) {
	let fragment, tpl;

	if ( dl[_items].length === 0 ) {
		return clear_selector(':scope > *:not(template)', dl);
	}

	tpl = dl.querySelector(':scope > template');

	if ( tpl === null ) {
		tpl = self_document.querySelector(':scope > template');
	}

	fragment = render_tpl(tpl, {
		type: dl[_items]
			.map(option => {
				let value = option.value,
					data = {tpl: option.tpl, value, children: {}};

				for ( let name in value ) {
					if ( Array.isArray(option.value[name]) ) {
						data.children[name] = value[name]
							.map(item => {
								return {value: item};
							});
					}
				}

				return data;
			})
	});

	clear_selector(':scope > *:not(template)', dl);

	dl.appendChild(fragment);

	dl[_options] = collection_selector(':scope option', dl);
}

function select_option(dl, rel_index, group = false) {
	let found_selected = false;

	if ( dl.length === 0 ) {
		return;
	}

	dl[_options]
		.some((node, index, list) => {
			if ( node.classList.contains('selected') ) {
				let next_index = index + rel_index, next_node;

				found_selected = true;

				if ( next_index === list.length ) {
					next_node = list[0];
				} else if ( next_index === -1 ) {
					next_node = list[list.length - 1];

					if ( group === true && next_node.parentNode.nodeName === 'OPTGROUP' ) {
						next_node = next_node.parentNode.firstElementChild;
					}
				} else {
					next_node = list[next_index];

					if ( group === true && node.parentNode.nodeName === 'OPTGROUP' ) {
						if ( rel_index === 1 ) {
							if ( node.parentNode.nextElementSibling ) {
								next_node = node.parentNode.nextElementSibling;
							} else {
								next_node = list[list.length - 1];
							}
						} else {
							if ( node.parentNode.previousElementSibling ) {
								next_node = node.parentNode.previousElementSibling;
							} else {
								next_node = list[0];
							}
						}

						if ( next_node.nodeName === 'OPTGROUP' ) {
							next_node = next_node.firstElementChild;
						}
					}
				}

				node.classList.remove('selected');
				next_node.classList.add('selected');

				return true;
			}
		});

	if ( found_selected === false ) {
		let next_node;

		if ( rel_index === 1 ) {
			next_node = dl[_options][0];
		} else {
			next_node = dl[_options][dl[_options].length - 1];

			if ( group === true && next_node.parentNode.nodeName === 'OPTGROUP' ) {
				next_node = next_node.parentNode.firstElementChild;
			}
		}

		next_node.classList.add('selected');
	}
}

function clear(dl) {
	dl[_options] = [];
	dl[_items] = [];
	render(dl);
}

window.document.registerElement('lw-datalist', {prototype: LwDataList.prototype});
