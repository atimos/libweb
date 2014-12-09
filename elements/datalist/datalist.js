'use strict';

import {list_item} from '../../common/renderer';

class DataList extends window.HTMLDataListElement {
	set data(value) {
		if ( Array.isArray(value) !== true ) {
			throw new Error('data has to be an array');
		}

		this.list = value;
		this.selected = -1;

		if ( this.is_attached === true ) {
			this.render();
		}
	}

	get data() {
		return this.list;
	}

	set value(value) {
		this.selected = Array.prototype.reduce.call(this.querySelectorAll('tt-datalist > *:not(template'), (index, node, node_index) => {
			if ( value === node.value ) {
				return node_index;
			} else {
				return index;
			}
		}, -1);

		this.render_selected();
	}

	get value() {
		if ( this.selected === -1 ) {
			return '';
		} else {
			return this.list[this.selected];
		}
	}

	createdCallback() {
		this.is_attached = false;
		this.list = [];
		this.selected = -1;
		this.targets = window.Array.prototype.slice.call(window.document.querySelectorAll(this.getAttribute('target')), 0);

		this.tpl = this.querySelector('template');
		if ( !this.tpl ) {
			this.tpl = this.document.querySelector('template');
		}
	}

	attachedCallback() {
		this.is_attached = true;
		this.render();
		window.addEventListener('keydown', this.keydown_event.bind(this));
	}

	detachedCallback() {
		window.removeEventListener('keydown', this.keydown_event.bind(this));
	}

	render() {
		let nodelist = document.createDocumentFragment();

		if ( this.is_attached === true ) {
			this.list.forEach(function(item) {
				console.log(item);
				nodelist.appendChild(list_item(this.tpl, item));
			}.bind(this));

			Array.prototype.forEach.call(this.querySelectorAll('tt-datalist > *:not(template'), function(node) {
				this.removeChild(node);
			}.bind(this));

			this.appendChild(nodelist);
		}
	}

	select_sibling(direction) {
		let pos = this.selected + (direction==='previous'?-1:+1);

		if ( pos < 0 ) {
			pos = 0;
		} else if ( pos >= this.list.length - 1 ) {
			pos = this.list.length - 1 ;
		}

		this.selected = pos;
		this.render_selected();
	}

	render_selected() {
		Array.prototype.forEach.call(this.children, function(node, index) {
			if ( index === this.selected ) {
				node.classList.add('selected');
			} else {
				node.classList.remove('selected');
			}
		}.bind(this));
	}

	keydown_event(evt) {
		this.targets.some(target => {
			if ( target !== evt.target ) { return false; }
			let key = evt.keyCode;

			if ( this.list.length > 0 ) {
				if ( key === 27 ) {
					this.data = [];
					evt.preventDefault();
				} else if ( key === 38 || ( key === 9 && evt.shiftKey ) ) {
					evt.preventDefault();
					this.select_sibling('previous');
				} else if ( key === 40 || ( key === 9 && !evt.shiftKey ) ) {
					evt.preventDefault();
					this.select_sibling('next');
				} else if ( key === 13 ) {
					if ( this.selected >= 0 ) {
						evt.preventDefault();

						if ( this.selected > -1 ) {
							this.dispatchEvent(new CustomEvent('select', {
								detail: {
									value: this.list[this.selected],
									target: target
								},
								bubbles: true,
								cancelable: true
							}));
						}
					}
				}
			}

			return true;
		});
	}
}

export default function(document) {
	DataList.prototype.document = document;
	window.document.registerElement('tt-datalist', {prototype: DataList.prototype});
}
