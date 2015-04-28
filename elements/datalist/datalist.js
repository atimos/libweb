'use strict';

import {array as dom_array} from '../../dom/collection';
import {selector as dom_clear_selector} from '../../dom/clear';
import {node as render_node} from '../../dom/render';

let _items = Symbol('options'),
	_groups = Symbol('groups'),
	_pos = Symbol('position'),
	_group_index = Symbol('group_index'),
	self_document = window.document.currentScript.ownerDocument;

class LwDataList extends window.HTMLDataListElement {
	set options(groups) {
		this[_groups] = groups;

		this[_items] = this[_groups]
			.map((group, group_index) => {
				if ( Array.isArray(group.options) ) {
					return group.options
						.map(option => {
							return {value: option, group: group.value, [_group_index]: group_index};
						});
				}
				return {value: group, group: null, [_group_index]: group_index};
			})
			.reduce((options, option) => {
				if ( Array.isArray(option) ) {
					option.forEach(option => {
						options.push(option);
					});
				} else {
					options.push(option);
				}

				return options;
			}, [])
			.filter(item => {
				return item !== undefined;
			});

		render(this);
	}

	get options() {
		return undefined;
	}

	get value() {
		return this[_items][this[_pos]];
	}

	createdCallback() {
		reset(this);
		this.addEventListener('keydown', keydown_event.bind(this));
	}

	attachedCallback() {
		render(this);
	}

	next() {
		if ( this[_pos] < this[_items].length - 1 ) {
			this[_pos] += 1;
			select_option(this);
		}
	}

	previous() {
		if ( this[_pos] > 0 ) {
			this[_pos] -= 1;
			select_option(this);
		}
	}

	next_group() {
		let pos = next_group(this, 1);

		if ( pos < this[_items].length ) {
			this[_pos] = pos;
			select_option(this);
		}
	}

	previous_group() {
		let pos = next_group(this, -1);

		if ( pos >= 0 ) {
			this[_pos] = pos;
			select_option(this);
		}
	}
}

function keydown_event(evt) {
	let key = evt.keyCode, shift_key = evt.shiftKey, dl = this;

	if ( key === 37 || ( key === 9 && shift_key ) ) {
		dl.previous_group();
	} else if ( key === 39 || ( key === 9 && !shift_key ) ) {
		dl.next_group();
	} else if ( key === 38 ) {
		dl.previous();
	} else if ( key === 40 ) {
		dl.next();
	} else if ( key === 27 ) {
		reset(dl);
	} else if ( key === 13 && dl.value !== undefined ) {
		dl.dispatchEvent(new CustomEvent('select', {detail:dl.value}));
		reset(dl);
	}
}

function render(dl) {
	let fragment, group_tpl, option_tpl;
	
	if ( dl[_items].length === 0 ) {
		return dom_clear_selector(':scope > *:not(template)', dl);
	}

	fragment = document.createDocumentFragment();
	group_tpl = dl.querySelector(':scope > template');

	if ( group_tpl === undefined ) {
		group_tpl = self_document.querySelector(':scope > template').content.children[0].cloneNode(true);
	} else {
		group_tpl = group_tpl.content.children[0].cloneNode(true);
	}

	if ( group_tpl.nodeName === 'OPTGROUP' ) {
		option_tpl = group_tpl.removeChild(group_tpl.children[0]);
	} else {
		option_tpl = group_tpl;
		group_tpl = document.createElement('optgroup');
	}

	dl[_groups]
		.forEach(item => {
			let group = group_tpl.cloneNode(true);

			if ( Array.isArray(item.options) ) {
				render_node(group, item.value);

				item.options.forEach(item => {
					let option = option_tpl.cloneNode(true);

					render_node(option, item);

					group.appendChild(option);
				});

				fragment.appendChild(group);
			} else {
				let option = option_tpl.cloneNode(true);

				render_node(option, item.value);

				fragment.appendChild(option);
			}
		});

	dom_clear_selector(':scope > *:not(template)', dl);

	dl.appendChild(fragment);

	select_option(dl);
}

function select_option(dl) {
	dom_array(':scope option', dl)
		.forEach((node, index) => {
			if ( index === dl[_pos] ) {
				node.classList.add('selected');
			} else {
				node.classList.remove('selected');
			}
		});
}

function reset(dl) {
	dl[_pos] = 0;
	dl[_items] = [];
	dl[_groups] = [];
	render(dl);
}

function next_group(dl, direction) {
	let pos = 0, group_index = dl.value[_group_index] + direction;

	dl[_groups]
		.some((group, index) => {
			if ( index === group_index ) {
				return true;
			}

			if ( Array.isArray(group.options) ) {
				pos += group.options.length;
			} else {
				pos += 1;
			}
		});

	return pos;
}

window.document.registerElement('lw-datalist', {prototype: LwDataList.prototype});
