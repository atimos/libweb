'use strict';

import {item as render_item} from '../../common/renderer';

let _hdata = '_data_', _document = '_document_';

class DataList extends window.HTMLDataListElement {
	set options(options) {
		let nodelist, tpl, value_key;

		if ( Array.isArray(options) !== true ) {
			throw new Error('options has to be an array');
		}

		this[_hdata].options = options;
		this[_hdata].focused = -1;


		if ( this.length === 0 ) {
			this.classList.add('empty');
		} else {
			this.classList.remove('empty');
		}

		nodelist = window.document.createDocumentFragment();

		tpl = document.createElement('option');
		tpl.appendChild(this[_hdata].tpl.content.cloneNode(true));
		value_key = this[_hdata].tpl.dataset.value;

		this.options.forEach(item => {
			let node = tpl.cloneNode(true);

			if ( value_key !== undefined ) {
				node.value = item[value_key];
			} else if ( item.value !== undefined ) {
				node.value = item.value;
			}

			nodelist.appendChild(render_item(node, item));
		});

		Array.prototype.forEach.call(this.querySelectorAll('tt-datalist > *:not(template'), node => {
			this.removeChild(node);
		});

		this.appendChild(nodelist);
		this.hidden = false;
	}

	get options() {
		return this[_hdata].options;
	}

	set value(value) {
		this[_hdata].value = value;

		this[_hdata].focused = Array.prototype.reduce.call(this.querySelectorAll('tt-datalist > *:not(template'), (focused, node, index) => {
			if ( value === node.value ) {
				return index;
			} else {
				return focused;
			}
		}, -1);
		
		render_focused(this);
	}

	get value() {
		return this[_hdata].value;
	}

	set hidden(val) {
		if ( val === true ) {
			this.style.display = 'none';
		} else if ( val === false ) {
			this.style.display = '';
		}
	}

	get hidden() {
		return (this.style.display === 'none');
	}

	set length(val) {
		throw new Error('length is readonly');
	}

	get length() {
		return this.options.length;
	}

	next() {
		focus_sibling(this, 1);
	}

	previous() {
		focus_sibling(this, -1);
	}

	select(index) {
		if ( index !== undefined ) {
			this.value = this.options[index];
		} else {
			this.value = this.options[this[_hdata].focused];
		}

		this.hidden = true;
		return this.value;
	}

	createdCallback() {
		this[_hdata] = {
			is_attached: false,
			options: [],
			focused: -1
		};

		this.hidden = true;

		this[_hdata].tpl = this.querySelector('template');

		if ( !this[_hdata].tpl ) {
			this[_hdata].tpl = this[_document].querySelector('template');
		}
	}

	attachedCallback() {
		this[_hdata].is_attached = true;
	}
}

function focus_sibling(datalist, step) {
	let pos = datalist[_hdata].focused + step;

	if ( pos < 0 ) {
		pos = 0;
	} else if ( pos >= datalist.length - 1 ) {
		pos = datalist.length - 1 ;
	}

	datalist[_hdata].focused = pos;
	render_focused(datalist);
}

function render_focused(datalist) {
	Array.prototype.forEach.call(datalist.querySelectorAll('tt-datalist > *:not(template'), (node, index) => {
		if ( index === datalist[_hdata].focused ) {
			node.classList.add('focused');
		} else {
			node.classList.remove('focused');
		}
	});
}

export default function(document) {
	DataList.prototype[_document] = document;
	window.document.registerElement('tt-datalist', {prototype: DataList.prototype});
}
