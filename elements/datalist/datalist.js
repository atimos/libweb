'use strict';

import {item as render_item} from '../../common/renderer';
import ResultMap from '../../common/resultmap';

let _hdata = '_data_', _document = '_document_';

class DataList extends window.HTMLDataListElement {
	set options(options) {
		if ( Array.isArray(options) !== true ) {
			throw new Error('options has to be an Array');
		}

		this[_hdata].options = options;
		this[_hdata].focused = -1;

		if ( options.length === 0 ) {
			this.hidden = true;

			Array.prototype.forEach.call(this.querySelectorAll('tt-datalist > *:not(template'), node => {
				this.removeChild(node);
			});
		} else {
			let nodelist = window.document.createDocumentFragment(),
				tpl_list = get_templates(this);

			this.options.forEach(option => {
				let tpl;

				if ( option.template !== undefined && tpl_list.has(option.template) ) {
					tpl = tpl_list.get(option.template);
				} else {
					tpl = tpl_list.value(0);
				}

				nodelist.appendChild(render_item(tpl.node.cloneNode(true), option.value));
			});

			Array.prototype.forEach.call(this.querySelectorAll('tt-datalist > *:not(template'), node => {
				this.removeChild(node);
			});

			this.appendChild(nodelist);

			this.hidden = false;
		}

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

	//TODO: change style to class when using shadow dom
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
			this.value = this.options[index].value;
		} else {
			this.value = this.options[this[_hdata].focused].value;
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

function get_templates(datalist) {
	let tpl_list = Array.prototype.slice.call(datalist.querySelectorAll('tt-datalist > template'), 0);
	
	if ( tpl_list.length === 0 ) {
		tpl_list = [datalist[_document].querySelector('template')];
	}

	return tpl_list.map(tpl => {
		let node = document.createElement('option');

		node.appendChild(tpl.content.cloneNode(true));
		node.className = tpl.className;

		return {
			name: tpl.dataset.name,
			node: node
		};
	}).reduce((map, tpl) => {
		map.set(tpl.name, tpl);
		return map;
	}, new ResultMap());
}

export default function(document) {
	DataList.prototype[_document] = document;
	window.document.registerElement('tt-datalist', {prototype: DataList.prototype});
}
