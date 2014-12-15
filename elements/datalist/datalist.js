'use strict';

import {list_item as render_list_item} from '../../common/renderer';

let _data = '_data_', _document = '_document_';


class DataList extends window.HTMLDataListElement {
	set data(value) {
		let nodelist;
		if ( Array.isArray(value) !== true ) {
			throw new Error('data has to be an array');
		}

		this[_data].data = value;
		this[_data].selected = -1;

		nodelist = window.document.createDocumentFragment();

		if ( this.data.length === 0 ) {
			this.classList.add('empty');
		} else {
			this.classList.remove('empty');
		}

		if ( this[_data].is_attached === true ) {
			this.data.forEach(item => {
				nodelist.appendChild(render_list_item(this[_data].tpl, item));
			});

			Array.prototype.forEach.call(this.querySelectorAll('tt-datalist > *:not(template'), node => {
				this.removeChild(node);
			});

			this.appendChild(nodelist);
		}
	}

	get data() {
		return this[_data].data;
	}

	set target(node) {
		this[_data].target = node;
	}

	get target() {
		return this[_data].target;
	}

	set value(value) {
		this[_data].selected = Array.prototype.reduce.call(this.querySelectorAll('tt-datalist > *:not(template'), (index, node, node_index) => {
			if ( value === node.value ) {
				return node_index;
			} else {
				return index;
			}
		}, -1);

		render_selected(this);
	}

	get value() {
		if ( this[_data].selected === -1 ) {
			return '';
		} else {
			return this.data[this[_data].selected];
		}
	}

	createdCallback() {
		this[_data] = {};
		this[_data].is_attached = false;
		this.data = [];
		this.target = window.document.querySelector(this.getAttribute('target'));

		this[_data].tpl = this.querySelector('template');
		if ( !this[_data].tpl ) {
			this[_data].tpl = this[_document].querySelector('template');
		}
	}

	attachedCallback() {
		this[_data].is_attached = true;
		this.data = this.data;
		this.target.addEventListener('keydown', keydown_event.bind(this));
	}

	detachedCallback() {
		this.target.removeEventListener('keydown', keydown_event.bind(this));
	}

	attributeChangedCallback(name, oldval, newval) {
		if ( name === 'target' ) {
			this.target = window.document.querySelector(newval);
		}
	}
}

function select_sibling(datalist, step) {
	let pos = datalist[_data].selcted + step;

	if ( pos < 0 ) {
		pos = 0;
	} else if ( pos >= datalist.data.length - 1 ) {
		pos = datalist.data.length - 1 ;
	}

	datalist[_data].selected = pos;
	render_selected(datalist);
}

function render_selected(datalist) {
	Array.prototype.forEach.call(datalist.children, (node, index) => {
		if ( index === this[_data].selected ) {
			node.classList.add('selected');
		} else {
			node.classList.remove('selected');
		}
	});
}

function keydown_event(evt) {
	let key = evt.keyCode;

	if ( this.data.length > 0 ) {
		if ( key === 27 ) {
			this.data = [];
			evt.preventDefault();
		} else if ( key === 38 || ( key === 9 && evt.shiftKey ) ) {
			evt.preventDefault();
			select_sibling(this, -1);
		} else if ( key === 40 || ( key === 9 && !evt.shiftKey ) ) {
			evt.preventDefault();
			select_sibling(this, 1);
		} else if ( key === 13 ) {
			if ( this[_data].selected >= 0 ) {
				evt.preventDefault();

				if ( this[_data].selected > -1 ) {
					this.dispatchEvent(new CustomEvent('select', {
						detail: {
							value: this.data[this[_data].selected],
							target: this.target
						},
						bubbles: true,
						cancelable: true
					}));
				}
			}
		}
	}
}

export default function(document) {
	DataList.prototype[_document] = document;
	window.document.registerElement('tt-datalist', {prototype: DataList.prototype});
}
