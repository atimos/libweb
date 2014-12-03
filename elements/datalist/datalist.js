'use strict';

/* jshint validthis: true */
var _data = '_data_', _elements = '_elements_';

var proto = Object.create(window.HTMLDataListElement.prototype);

class test extends window.HTMLDataListElement.prototype {
	construct(document) {
		//this.document = document;
	}
}

export default test;

/*
export default class extends window.HTMLDataListElement.prototype {
	construct(document) {
		this.document = document;
	}
}

*/
Object.defineProperty(proto, _elements, {
	writeable: false,
	enumerable: false,
	configurable: false,
	value: {
		targets: null,
		tpl: null
	}
});

Object.defineProperty(proto, _data, {
	writeable: false,
	enumerable: false,
	configurable: false,
	value: {
		list: [],
		selected: -1,
		is_attached: false
	}
});

Object.defineProperties(proto, {
	value: {
		configurable: false,
		get: function() {
			return this[_data].list[this[_data].selected];
		},
		set: function() { throw(new TypeError('\'value\' is read-only')); }
	},
	update: {
		writeable: false,
		enumerable: false,
		configurable: false,
		value: function(list) {
			this[_data].selected = -1;
			this[_data].list = list;
			render.call(this);
		}
	},
});

function render() {
	var tpl, nodelist = document.createDocumentFragment();

	if ( this[_data].is_attached === true ) {
		tpl = this.querySelector('template');

		if ( !tpl ) {
			tpl = document.querySelector('template');
		}

		this[_data].list.forEach(function(item) {
			nodelist.appendChild(render_tpl(tpl, item));
		}.bind(this));

		Array.prototype.forEach.call(this.querySelectorAll('tt-datalist > *:not(template'), function(node) {
			this.removeChild(node);
		}.bind(this));

		this.appendChild(nodelist);
	}
}

function render_selected() {
	Array.prototype.forEach.call(this.children, function(node, index) {
		if ( index === this[_data].selected ) {
			node.classList.add('selected');
		} else {
			node.classList.remove('selected');
		}
	}.bind(this));
}

function select_sibling(direction) {
	var pos = this[_data].selected + (direction==='previous'?-1:+1);

	if ( pos < 0 ) {
		pos = 0;
	} else if ( pos >= this[_data].list.length - 1 ) {
		pos = this[_data].list.length - 1 ;
	}

	this[_data].selected = pos;
	render_selected.call(this);
}

function keydown_event(evt) {
	this[_data].targets.some(function(item) {
		if ( item !== evt.target ) { return false; }
		var key = evt.keyCode;

		if ( this[_data].list.length > 0 ) {
			if ( key === 27 ) {
				this.update([]);
				evt.preventDefault();
			} else if ( key === 38 || ( key === 9 && evt.shiftKey ) ) {
				evt.preventDefault();
				select_sibling.call(this, 'previous');
			} else if ( key === 40 || ( key === 9 && !evt.shiftKey ) ) {
				evt.preventDefault();
				select_sibling.call(this, 'next');
			} else if ( key === 13 ) {
				if ( this[_data].selected >= 0 ) {
					evt.preventDefault();

					if ( this.value !== undefined ) {
						this.dispatchEvent(new CustomEvent('select', {
							detail: {
								value: this.value,
								target: item
							},
							bubbles: true,
							cancelable: true
						}));
					}
				}
			}
		}

		return true;
	}.bind(this));
}

proto.attachedCallback = function() {
	this[_data].is_attached = true;

	this[_data].targets = window.Array.prototype.slice.call(window.document.querySelectorAll(this.getAttribute('target')), 0);

	window.addEventListener('keydown', keydown_event.bind(this));
	render.bind(this);
};

proto.detachedCallback = function() {
	window.removeEventListener('keydown', keydown_event.bind(this));
};

proto.attributeChangedCallback = function(name, old_value, new_value) {
	if ( name === 'targets' ) {
		this[_data].targets = window.Array.prototype.slice.call(window.document.querySelectorAll(new_value), 0);
	}
};

function render_tpl(tpl, data) {
	var element = tpl.content.cloneNode(true).firstElementChild;

	if ( data.value !== undefined ) {
		element.value = data.value;
	}

	Array.prototype.forEach.call(element.querySelectorAll('[data-key]'), function(node) {
		node.dataset.key.split('|').some(function(key) {
			if ( data[key] !== undefined ) {
				node.textContent = data[key];
				return true;
			}
		});
		delete node.dataset.key;
	});

	return element;
}

window.document.registerElement('tt-datalist', { prototype: proto });
