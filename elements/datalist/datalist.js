'use strict';

import {array as dom_array} from '../../dom/collection';
import {item as render_item} from '../../dom/render';

let _opt = Symbol('options'),
	_pos = Symbol('position'),
	self_document = window.document.currentScript.ownerDocument;

class DataList extends window.HTMLDataListElement {
	set options(options) {
		if ( Array.isArray(options) !== true ) {
			throw new Error('options has to be an Array');
		}
		this[_opt] = options;
		this[_pos] = -1;
		render(this);
	}

	get options() {
		return this[_opt];
	}

	get value() {
		return this.options[this[_pos]];
	}

	createdCallback() {
		this[_pos] = -1;
		this[_opt] = [];
		this.addEventListener('keydown', keydown_event.bind(this));
	}

	attachedCallback() {
		render(this);
	}
}

function keydown_event(evt) {
	let key = evt.keyCode, dl = evt.target, pos = dl[_pos];

	if ( key === 40 || ( key === 9 && !evt.shiftKey ) ) {
		pos += 1;
	} else if ( key === 38 || ( key === 9 && evt.shiftKey ) ) {
		pos -= 1;
	} else if ( key === 27 ) {
		dl.options = [];
	} else if ( key === 13 && dl.value !== undefined ) {
		dl.dispatchEvent(new CustomEvent('select', {detail:dl.value}));
		dl.options = [];
	}

	if ( pos > -1 && pos < dl.options.length ) {
		dl[_pos] = pos;
		select_element(dl);
	}
}

function render(dl) {
	let node_list,
		option = document.createElement('option'),
		template = dl.querySelector(':scope > template');

	if ( template === undefined ) {
		template = self_document.querySelector(':scope > template');
	}

	option.appendChild(template.content.cloneNode(true));

	node_list = dl.options
		.map(item => {
			return render_item(option.cloneNode(true), item);
		})
		.reduce((node_list, node) => {
			node_list.appendChild(node);
			return node_list;
		}, document.createDocumentFragment());

	dom_array(':scope > *:not(template)', dl)
		.forEach(node => {
			node.parentNode.removeChild(node);
		});

	dl.appendChild(node_list);
}

function select_element(dl) {
	dom_array(':scope > *:not(template)', dl)
		.forEach((node, index) => {
			if ( index === dl[_pos] ) {
				node.classList.add('selected');
			} else {
				node.classList.remove('selected');
			}
		});
}

window.document.registerElement('lw-datalist', {prototype: DataList.prototype});
