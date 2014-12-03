(function(window, document, undefined) {
	'use strict';

	/* jshint validthis: true */

	var _data = '_datas', _config = '_configs', _elements = '_elementss';

	var proto = Object.create(HTMLTableElement.prototype),
		tpl = {
			header: document.querySelector('template:nth-of-type(2)'),
			body: document.querySelector('template:nth-of-type(3)'),
			footer: document.querySelector('template:nth-of-type(4)'),
			pagination: document.querySelector('template:nth-of-type(5)')
		};

	Object.defineProperty(proto, _elements, {
		writeable: false,
		enumerable: false,
		configurable: false,
		value: {
			search: document.querySelector('menu input'),
			header: null,
			body: null,
			pagination: null,
			root: null,
		}
	});

	Object.defineProperty(proto, _data, {
		writeable: false,
		enumerable: false,
		configurable: false,
		value: {
			delay: null,
			query: '',
			data: [],
			dataview: [],
			dataviewslice: [],
			sumary: {},
			pagination: {
				page: 1,
				pages: 0
			},
			changed: false,
			is_attached: false
		}
	});

	Object.defineProperty(proto, _config, {
		writeable: false,
		enumerable: false,
		configurable: false,
		value: {
			columns: [],
			page_size: 10,
			order_by: [],
		}
	});

	Object.defineProperties(proto, {
		sumary: {
			get: function() { return this[_data].sumary; },
			set: function() { throw(new TypeError('\'page\' is read-only')); }
		},
		page: {
			get: function() { return this[_data].pagination.page; },
			set: function(page) {
				this[_data].pagination.page = page;
				render.call(this);
			}
		},
		page_size: {
			configurable: false,
			get: function() { return this[_config].page_size; },
			set: function(value) {
				this[_data].changed = true;
				this[_config].page_size = value;
				render.call(this);
			}
		},
		columns: {
			configurable: false,
			get: function() { return this[_config].columns; },
			set: function(value) {
				this[_data].changed = true;
				this[_config].columns = value;
				render.call(this);
			}
		},
		data: {
			configurable: false,
			get: function() { return this[_data].data; },
			set: function(value) {
				this[_data].changed = true;
				this[_data].data = value;
				render.call(this);
		   }
		},
		order_by: {
			configurable: false,
			get: function() { return this[_config].order_by; },
			set: function(value) {
				this[_data].changed = true;
				this[_config].order_by = value;
				render.call(this);
			}
		},
	});

	Object.defineProperties(proto, {
		search: {
			writeable: false,
			enumerable: false,
			configurable: false,
			value: function(query) {
				query = query.toLowerCase();
				clearTimeout(this[_data].delay);

				this[_data].delay = setTimeout(function() {
					if ( this[_data].query !== query ) {
						this.jump_to(1);
						this[_data].changed = true;
						this[_data].query = query;

						render.call(this);
					}
				}.bind(this), 200);
			}
		},
		jump_to: {
			writeable: false,
			enumerable: false,
			configurable: false,
			value: function(page) {
				this[_data].pagination.page = page;
				render.call(this);
			}
		},
	});

	function render() {
		if ( this[_data].changed === true ) {
			generate_viewdata.call(this);
		}

		generate_viewdataslice.call(this);

		if ( this[_data].changed === true ) {
			calculate_sumary.call(this);
			calculate_pagination.call(this);
			this[_data].changed = false;
		}

		if ( this[_data].is_attached ) {
			if ( this[_elements].tpl.header ) {
				render_header.call(this);
			}
			if ( this[_elements].tpl.body ) {
				render_body.call(this);
			}
			if ( this[_elements].tpl.footer ) {
				render_footer.call(this);
			}
			if ( this[_elements].tpl.pagination ) {
				render_pagination.call(this);
			}
		}
	}

	function generate_viewdata() {
		var dataview, query = this[_data].query;

		if ( query === '' ) {
			dataview = this[_data].data.slice(0);
		} else {
			dataview = this[_data].data.filter(function(item) {
				return this.columns.some(function(column) {
					var value = item[column.id];
					if ( column.search === true ) {
						switch ( Object.prototype.toString.call(value) ) {
							case '[object String]':
								if ( value.toLowerCase().indexOf(query) !== -1 ) {
									return true;
								}
								break;
							case '[object Number]':
								if ( value === parseInt(query) ) {
									return true;
								}
								break;
							case '[object Boolean]':
								if ( value.toString() === query ) {
									return true;
								}
								break;
							default:
								if ( value === query ) {
									return true;
								}
						}
					}
				});
			}.bind(this));
		}

		this.order_by.reduce(function(order_by, item) {
			order_by.unshift(item);
			return order_by;
		}, []).forEach(function(order_by) {
			var dir = order_by.direction || 'asc',
				col = order_by.column;

			dataview.sort(function(a, b) {
				if ( dir  === 'asc' && a[col] < b[col] || dir === 'desc' && a[col] > b[col] ) {
					return -1;
				} else if ( dir  === 'asc' && a[col] > b[col] || dir === 'desc' && a[col] < b[col] ) {
					return 1;
				} else {
					return 0;
				}
			});
		});

		this[_data].dataview = dataview;
	}

	function generate_viewdataslice() {
		var pos = (this.page - 1) * this.page_size;
		this[_data].dataviewslice = this[_data].dataview.slice(pos, pos + this.page_size);
	}

	function calculate_sumary() {
		this[_data].sumary = this.columns.map(function(col) {
			if ( col.sum === true ) {
				return col.id;
			} else {
				return null;
			}
		}).filter(function(id) {
			return (id !== null);
		}).reduce(function(result, id) {
			result[id] = {
				data: this[_data].data.reduce(function(result, item) { return result += item[id]; }, 0),
				dataview: this[_data].dataview.reduce(function(result, item) { return result += item[id]; }, 0),
				dataviewslice: this[_data].dataviewslice.reduce(function(result, item) { return result += item[id]; }, 0),
			};

			return result;
		}.bind(this), {});
	}

	function calculate_pagination() {
		this[_data].pagination.pages = Math.ceil(this[_data].dataview.length / this[_config].page_size);
		if ( this[_data].pagination.pages === 0 ) {
			this[_data].pagination.pages = 1;
		}
	}

	function render_header() {
		if ( Array.isArray(this.columns) ) {
			var header = window.document.createDocumentFragment();

			this.columns.forEach(function(column) {
				header.appendChild(this[_elements].tpl.header.content.children[0].cloneNode(true));

				this[_config].order_by.some(function(order_item) {
					if ( order_item.column === column.id ) {
						header.lastElementChild.dataset.order = order_item.direction || 'asc';
						return true;
					}
				});

				header.lastElementChild.children[0].textContent = column.name;
				header.lastElementChild.dataset.id = column.id;
			}.bind(this));

			this[_elements].header.innerHTML = '';
			this[_elements].header.appendChild(header);
		}
	}

	function render_body() {
		var body = document.createDocumentFragment();

		this[_data].dataviewslice.forEach(function(item) {
			var row = document.createElement('tr');

			this.columns.forEach(function(column_config) {
				var column = this[_elements].tpl.body.content.cloneNode(true);

				column.children[0].textContent = item[column_config.id];
				row.appendChild(column);
			}.bind(this));

			body.appendChild(row);
		}.bind(this));

		this[_elements].body.innerHTML = '';
		this[_elements].body.appendChild(body);
	}

	function render_footer() {
		this[_elements].footer.children[0].innerHTML = '';
		this[_elements].footer.children[1].innerHTML = '';
		this[_elements].footer.children[2].innerHTML = '';

		this.columns.forEach(function(column_config) {
			var sumary = this.sumary[column_config.id],
				data = this[_elements].tpl.footer.content.cloneNode(true).children[0],
				dataview = this[_elements].tpl.footer.content.cloneNode(true).children[0],
				dataviewslice = this[_elements].tpl.footer.content.cloneNode(true).children[0];

			if ( sumary !== undefined ) {
				data.textContent = sumary.data;
				dataview.textContent = sumary.dataview;
				dataviewslice.textContent = sumary.dataviewslice;
			}

			this[_elements].footer.children[0].appendChild(dataviewslice);
			this[_elements].footer.children[1].appendChild(dataview);
			this[_elements].footer.children[2].appendChild(data);
		}.bind(this));
	}

	function render_pagination() {
		var pagination = this[_elements].tpl.pagination.content.cloneNode(true),
			page = pagination.querySelector('[data-value="page"]'),
			pages = pagination.querySelector('[data-value="pages"]'),
			rows = pagination.querySelector('[data-value="rows"]'),
			rows_total = pagination.querySelector('[data-value="rows-total"]');

		if ( page ) {
			page.textContent = this.page;
		}
		if ( pages ) {
			pages.textContent = this[_data].pagination.pages;
		}
		if ( rows ) {
			rows.textContent = this[_data].dataview.length;
		}
		if ( rows_total ) {
			rows_total.textContent = this[_data].data.length;
		}

		this[_elements].pagination.innerHTML = '';
		this[_elements].pagination.appendChild(pagination);
	}

	function add_event_handlers() {
		if ( this[_elements].search ) {
			this[_elements].search.addEventListener('keyup', function(evt) {
				this.search(evt.target.value);
			}.bind(this));
		}

		this[_elements].header.addEventListener('click', function(evt) {
			var dir = '', column;
			if ( evt.target.nodeName === 'A' ) {
				evt.preventDefault();
				column = evt.target.parentNode.dataset.id;

				switch (evt.target.parentNode.dataset.order) {
					case 'asc':
						dir = 'desc';
						break;
					case 'desc':
						dir = '';
						break;
					default:
						dir = 'asc';
				}

				this.order_by = [{column: column, direction: dir}];

				Array.prototype.forEach.call(this[_elements].header.querySelectorAll('th'), function(node) {
					if ( node.dataset.id === column ) {
						node.dataset.order = dir;
					} else {
						node.dataset.order = '';
					}
				});
			}
		}.bind(this));

		this[_elements].pagination.addEventListener('click', function(evt) {
			if ( evt.target.nodeName === 'A' ) {
				var page = this.page;

				evt.preventDefault();

				switch ( evt.target.dataset.action ) {
					case 'first':
						page = 1;
						break;
					case 'last':
						page = this[_data].pagination.pages;
						break;
					case 'previous':
						page = (page>1?page-1:1);
						break;
					case 'next':
						page = (page<this[_data].pagination.pages?page+1:this[_data].pagination.pages);
						break;
				}
				this.jump_to(page);
			}
		}.bind(this));

	}

	proto.attachedCallback = function() {
		this[_data].is_attached = true;
		render.call(this);
	};

	proto.createdCallback = function() {
		this.appendChild(document.importNode(document.querySelector('template:nth-of-type(1)').content, true));
		this[_elements].header = this.children[2].children[0];
		this[_elements].body = this.children[2].children[1];
		this[_elements].footer = this.children[2].children[2];
		this[_elements].search = this.querySelector('menu input');
		this[_elements].pagination = this.querySelector('nav');
		add_event_handlers.call(this);
	};

	window.document.registerElement('tt-table', { prototype: proto });
}(window, window.document.currentScript.ownerDocument, void(0)));
