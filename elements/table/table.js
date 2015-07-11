'use strict';

import {selector as clear_selector} from '../../dom/clear';
import {selector as collection_selector} from '../../dom/collection';
import render_tpl from '../../dom/render';

let _head = Symbol('head'),
	_col = Symbol('columns'),
	_val = Symbol('value'),
	_foot = Symbol('footer'),
	_sort = Symbol('sort'),
	self_document = window.document.currentScript.ownerDocument;

class LwTable extends window.HTMLTableElement {
	get columns() {
		return this[_head];
	}

	set columns(value) {
		this[_head] = value;

		this[_col] = value
			.map(column => {
				if ( column.type !== undefined ) {
					return column.key;
				}
			})
			.filter(item => {
				return (item !== undefined);
			});

		this.value = [];
	}

	get value() {
		return undefined;
	}

	set value(value) {
		this[_val] = value;
		this.sort();
	}

	sort(column, order) {
		if ( column === undefined ) {
			this[_sort] = {column: null, order: null};
		} else {
			if ( column === this[_sort].column ) {
				this[_sort].order = order || (this[_sort].order === 'asc' ? 'desc' : 'asc');
			} else {
				this[_sort].column = column;
				this[_sort].order = order || 'asc';
			}

			this[_val] = sort(this, this[_val], this[_sort].column, this[_sort].order);
		}

		render_head(this);
		render(this);
	}

	clear() {
		clear(this);
	}

	next() {
		console.log('next');
	}

	previous() {
		console.log('previous');
	}

	createdCallback() {
		this.appendChild(document.createElement('thead'));
		this.appendChild(document.createElement('tbody'));

		clear(this);
	}

	attachedCallback() {
		this.addEventListener('click', click.bind(this));
	}

	detachedCallback() {
		this.removeEventListener('click', click.bind(this));
	}
}

function click(evt) {
	if ( evt.target.nodeName.toLowerCase() === 'button' ) {
		this.sort(evt.target.dataset.column, null);
	}
}

function clear(table) {
	table[_sort] = {column: null, order: null};
	table[_col] = [];
	table[_head] = [];
	table[_val] = [];
}

function sort(table, data, key, order) {
	key = table[_head]
		.reduce((key, column) => {
			if ( key === column.key && column.sort_key !== undefined ) {
				return column.sort_key;
			}

			return key;
		}, key);

	if ( order === 'asc' ) {
		data.sort((a, b) => {
			if ( a[key] < b[key] ) {
				return 1;
			} else if ( a[key] > b[key] ) {
				return -1;
			}

			return 0;
		});
	} else if ( order === 'desc' ) {
		data.sort((a, b) => {
			if ( a[key] > b[key] ) {
				return 1;
			} else if ( a[key] < b[key] ) {
				return -1;
			}

			return 0;
		});
	}

	return data;
}

function render_head(table) {
	let head = document.createElement('thead'),
		fragment = render_tpl(self_document.querySelector('template'), {
			row: {
				children: {
					col: table[_head]
						.map(column => {
							if ( column.key === table[_sort].column ) {
								column.order = table[_sort].order;
							}

							return {tpl: column.type || 'nosort', value: column};
						})
					}
			}
		});

	head.appendChild(fragment);

	table.replaceChild(head, table.querySelector(':scope > thead'));
}

function render(table) {
	let body = document.createElement('tbody'),
		tpl = table.querySelector('template'),
		fragment;

	if ( tpl === null ) {
		tpl = self_document.querySelector('template:nth-of-type(2)');
	}

	fragment = render_tpl(tpl, {
		row: table[_val]
			.map(item => {
				let row = {
					tpl: item.type,
					value: item.value || {},
					children: {}
				};

				table[_col]
					.forEach(column => {
						if ( Object.prototype.toString.call(item[column]) === '[object Object]' ) {
							row.children[column] = {value: item[column]};
						} else {
							row.children[column] = {value: {[column]: item[column]}};
						}
					});

				return row;
			})
	});

	body.appendChild(fragment);

	table.replaceChild(body, table.querySelector(':scope > tbody'));
}

window.document.registerElement('lw-table', {prototype: LwTable.prototype});
