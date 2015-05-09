'use strict';

import {selector as clear_selector} from '../../dom/clear';
import {selector as collection_selector} from '../../dom/collection';
import render_tpl from '../../dom/render';

let _items = Symbol('options'),
	_groups = Symbol('groups'),
	_pos = Symbol('position'),
	_group_index = Symbol('group_index'),
	self_document = window.document.currentScript.ownerDocument;

class LwDataList extends window.HTMLDataListElement {
	set options(groups) {
		clear(this);

		this[_groups] = groups;

		this[_items] = this[_groups]
			.map((group, group_index) => {
				if ( Array.isArray(group.options) ) {
					return group.options
						.map(option => {
							return {tpl: option.tpl, value: option, group: group.value, [_group_index]: group_index};
						});
				}
				return {tpl: option.tpl, value: group, group: null, [_group_index]: group_index};
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

	get length() {
		return this[_items].length;
	}

	createdCallback() {
		clear(this);
		this.addEventListener('keydown', keydown_event.bind(this));
	}

	attachedCallback() {
		render(this);
	}

	clear() {
		clear(this);
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
	let key = evt.key, dl = this;

	if ( key === 'ArrowLeft' || ( evt.keyCode === 9 && evt.shiftKey ) ) {
		dl.previous();
	} else if ( key === 'ArrowRight' || key === 'Tab' ) {
		dl.next();
	} else if ( key === 'ArrowUp' ) {
		dl.previous_group();
	} else if ( key === 'ArrowDown' ) {
		dl.next_group();
	} else if ( key === 'Escape' ) {
		clear(dl);
	} else if ( key === 'Enter' && dl.value !== undefined ) {
		dl.dispatchEvent(new CustomEvent('select', {detail:dl.value}));
		clear(dl);
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
		group: dl[_groups]
			.map(group => {
				return {
					value: group.value,
					children: {option: group.options
						.map(option => {
							if ( option.tpl !== undefined ) {
								let tpl = option.tpl;
								delete option.tpl;

								return {tpl: tpl, value: option};
							}

							return {value: option};
						})
					}
				};
			})
	});

	clear_selector(':scope > *:not(template)', dl);

	dl.appendChild(fragment);
}

function select_option(dl) {
	collection_selector(':scope option', dl)
		.forEach((node, index) => {
			if ( index === dl[_pos] ) {
				node.classList.add('selected');
			} else {
				node.classList.remove('selected');
			}
		});
}

function clear(dl) {
	dl[_pos] = -1;
	dl[_items] = [];
	dl[_groups] = [];
	render(dl);
}

function next_group(dl, direction) {
	let pos = 0, group_index;

	if ( dl.value === undefined ) {
		return 0;
	}

	group_index = dl.value[_group_index] + direction;

	if ( group_index < 0 ) {
		return 0;
	}

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
