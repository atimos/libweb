(function(window, document, undefined) {
	'use strict';

	/* jshint validthis: true */

	var _data = '_data_', _elements = '_elements_';

	var proto = Object.create(window.HTMLDataListElement.prototype);

	var tpl = {
		item: document.querySelector('template:nth-of-type(2)')
	};

	Object.defineProperty(proto, _elements, {
		writeable: false,
		enumerable: false,
		configurable: false,
		value: {
			root: null,
			targets: null
		}
	});

	Object.defineProperty(proto, _data, {
		writeable: false,
		enumerable: false,
		configurable: false,
		value: {
			list: [],
			selected: -1,
			changed: false,
			is_attached: false
		}
	});

	Object.defineProperties(proto, {
		list: {
			configurable: false,
			get: function() { return this[_data].list; },
			set: function(list) {
				this[_data].list = list;
				this[_data].changed = true;
				render.call(this);
			}
		},
		value: {
			configurable: false,
			get: function() {
				if ( this.list[this[_data].selected] !== undefined ) {
					return this.list[this[_data].selected].value;
				} else {
					return undefined;
				}
			},
			set: function() { throw(new TypeError('\'value\' is read-only')); }
		}
	});

	Object.defineProperty(proto, 'reset', {
		writeable: false,
		enumerable: false,
		configurable: false,
		value: function() {
			this[_data].selected = -1;
			this.list = [];
		}
	});

	function render() {
		var nodelist = document.createDocumentFragment();

		if ( this[_data].changed === true && this[_data].is_attached === true ) {
			this[_data].list.forEach(function(item) {
				var detail, node = tpl.item.content.cloneNode(true).firstElementChild;
				node.textContent = (item.name!==undefined?item.name:item.value);

				detail = {
					node: node,
					item: item
				};

				this.dispatchEvent(new CustomEvent( 'render_item', {
					detail: detail,
					bubbles: true,
					cancelable: true
				}));

				if ( detail.node instanceof HTMLElement || detail.node instanceof Node ) {
					nodelist.appendChild(detail.node.cloneNode(true));
				}
			}.bind(this));

			this[_elements].root.innerHTML = '';
			this[_elements].root.appendChild(nodelist);
		}
	}

	function render_selected() {
		Array.prototype.forEach.call(this[_elements].root.children, function(node, index) {
			if ( index === this[_data].selected ) {
				node.classList.add('selected');
			} else {
				node.classList.remove('selected');
			}
		}.bind(this));
	}

	function select_previous() {
		var pos = this[_data].selected;

		if ( pos < 0 ) {
			pos = 0;
		} else if ( pos !== 0 ) {
			pos -= 1;
		}

		this[_data].selected = pos;
		render_selected.call(this);
	}

	function select_next() {
		var pos = this[_data].selected;

		if ( pos < 0 ) {
			pos = 0;
		} else if ( pos >= this[_data].list.length - 1 ) {
			pos = this[_data].list.length - 1 ;
		} else {
			pos += 1;
		}

		this[_data].selected = pos;
		render_selected.call(this);
	}

	function keydown_event(evt) {
		this[_data].targets.some(function(item) {
			if ( item !== evt.target ) { return false; }
			var key = evt.keyCode;

			if ( this.list.length > 0 ) {
				if ( key === 38 || ( key === 9 && evt.shiftKey ) ) {
					evt.preventDefault();
					select_previous.call(this);
				} else if ( key === 40 || ( key === 9 && !evt.shiftKey ) ) {
					evt.preventDefault();
					select_next.call(this);
				} else if ( key === 13 ) {
					if ( this[_data].selected >= 0 ) {
						var value = this.value;

						this.list = [];
						evt.preventDefault();

						if ( value !== undefined ) {
							this.dispatchEvent(new CustomEvent('select', {
								detail: {
									value: value,
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

	proto.createdCallback = function() {
		this.appendChild(document.importNode(document.querySelector('template:nth-of-type(1)').content, true));
		this[_elements].root = this.querySelector('ul');
	};

	proto.attributeChangedCallback = function(name, old_value, new_value) {
		if ( name === 'targets' ) {
			this[_data].targets = window.Array.prototype.slice.call(window.document.querySelectorAll(new_value), 0);
		}
	};

	window.document.registerElement('tt-datalist', { prototype: proto });
}(window, window.document.currentScript.ownerDocument, void(0)));
