(function(window, document, undefined) {
	'use strict';

	var table = Object.create(HTMLTableElement.prototype);

	table.page = 0;
	table.page_size = 10;
	table.data = {
		original: [],
		rendered: [],
	};
	table.headers = [];
	table.order_column = null;
	table.order_direction = 'asc';

	table.render_head = function() {

		if ( Array.isArray(this.headers) ) {
			var new_head = document.createDocumentFragment();

			this.headers.forEach(function(column) {
				if ( column.sortable === true ) {
					new_head.appendChild(templates.head.content.children[0].cloneNode(true));
				} else {
					new_head.appendChild(templates.head.content.children[1].cloneNode(true));
				}

				new_head.lastElementChild.children[0].textContent = column.name;
				new_head.lastElementChild.dataset.id = column.id;
			});

			this.firstElementChild.firstElementChild.innerHTML = '';
			this.firstElementChild.firstElementChild.appendChild(new_head);
		}
	};

	table.render_body = function() {
		if ( Array.isArray(this.render_data) ) {
			if ( this.order_column !== null ) {
				var column = sort_options.column;
				var direction = sort_options.direction || 'asc';

				render_data.sort(function(a, b) {

					if ( direction  === 'asc' && a[column] < b[column] || direction === 'desc' && a[column] > b[column] ) {
						return -1;
					} else if ( direction  === 'asc' && a[column] > b[column] || direction === 'desc' && a[column] < b[column] ) {
						return 1;
					} else {
						return 0;
					}
				});
			}

		var new_body = document.createDocumentFragment();
		var end = render_data.length;

		if ( options.pagination_step ) {
			end = current_position + options.pagination_step;
		}

		render_data.slice(current_position, end).forEach(function(row) {
			var row_node = document.createElement('tr');
			row_node.dataset.id = row[options.row_id];

			options.headers.forEach(function(column) {
				var column_node = templates.body.content.cloneNode(true).children[0];
				column_node.textContent = row[column.id];
				column_node.dataset.value = row[column.id];
				row_node.appendChild(column_node);
			});

			new_body.appendChild(row_node);
		});

		table.children[1].innerHTML = '';
		table.children[1].appendChild(new_body);

		pagination.children[2].textContent = current_position + 1;
		pagination.children[3].textContent = (current_position + options.pagination_step > render_data.length? render_data.length:current_position + options.pagination_step);
		pagination.children[4].textContent = render_data.length;
		pagination.children[5].textContent = data.length;
		}
	};

	table.attachedCallback = function() {
		console.log(this);
		this.templates = {
			head: this.querySelector('template:nth-of-type(1)'),
			body: this.querySelector('template:nth-of-type(2)'),
			foot: this.querySelector('template:nth-of-type(3)')
		};
		console.log(this.templates);
	};

	table.attributeChangedCallback = function(attribute, old_value, new_value) {
		if ( attribute === 'page_size' ) {
			if ( this.data.length > 0 ) {
				this.render_body();
			}

			this.render_foot();
		} else if ( attribute === 'headers' ) {
			this.headers = JSON.parse(new_value);
			this.render_head();

			if ( this.data.length > 0 ) {
				this.render_body();
			}

			this.render_foot();
		}
		if ( attribute === 'data' ) {
			this.data = JSON.parse(new_value);

			if ( this.data.length > 0 ) {
				this.render_body();
			}

			this.render_foot();
		}
	};

	var test = document.registerElement('sg-table', {prototype: table});

	function render_body() {
	}

	function render_foot() {
		var pagination_sum = document.createDocumentFragment();
		var search_sum = document.createDocumentFragment();
		var total_sum = document.createDocumentFragment();
		var end = render_data.length;

		if ( options.pagination_step ) {
			end = current_position + options.pagination_step;
		}

		calculate_sum(render_data, current_position, end).forEach(function(column) {
			pagination_sum.appendChild(templates.foot.content.cloneNode(true));
			pagination_sum.lastElementChild.textContent = column.value;
			pagination_sum.lastElementChild.dataset.id = column.id;
			pagination_sum.lastElementChild.dataset.value = column.id;

		});

		calculate_sum(render_data, 0, render_data.length).forEach(function(column) {
			search_sum.appendChild(templates.foot.content.cloneNode(true));
			search_sum.lastElementChild.textContent = column.value;
			search_sum.lastElementChild.dataset.id = column.id;
			search_sum.lastElementChild.dataset.value = column.id;
		});

		calculate_sum(data, 0, data.length).forEach(function(column) {
			total_sum.appendChild(templates.foot.content.cloneNode(true));
			total_sum.lastElementChild.textContent = column.value;
			total_sum.lastElementChild.dataset.id = column.id;
			total_sum.lastElementChild.dataset.value = column.id;

		});

		table.children[2].children[0].innerHTML = '';
		table.children[2].children[0].appendChild(pagination_sum);
		table.children[2].children[1].innerHTML = '';
		table.children[2].children[1].appendChild(search_sum);
		table.children[2].children[2].innerHTML = '';
		table.children[2].children[2].appendChild(total_sum);
	}

	function calculate_sum(data, start, stop) {
		var columns = new Array(options.headers.length -1);

		return data.slice(start, stop).reduce(function(columns, row) {
			options.headers.forEach(function(column, column_pos) {
				if ( columns[column_pos] === undefined ) {
					if ( column.sum === true ) {
						columns[column_pos] = {id: column.id, value: 0};
					} else {
						columns[column_pos] = {id: column.id, value: ''};
					}
				}

				if ( column.sum === true ) {
					columns[column_pos].value += row[column.id];
				}
			});
			return columns;
		}, columns);
	}

	function render() {

	}

	function search(query) {
		current_position = 0;

		if ( query === '' ) {
			render_data = data;
		} else {
			render_data = data.filter(function(item) {
				return options.headers.some(function(column) {
					if ( column.searchable === true ) {
						switch ( Object.prototype.toString.call(item[column.id]) ) {
							case '[object String]':
								if ( item[column.id].toLowerCase().indexOf(query) !== -1 ) {
								return true;
							}
							break;
							case '[object Number]':
								if ( item[column.id] === parseInt(query) ) {
								return true;
							}
							break;
							case '[object Boolean]':
								if ( item[column.id].toString() === query ) {
								return true;
							}
							break;
							default:
								if ( item[column.id] === query ) {
								return true;
							}
						}
					}
				});
			});
		}
	}

	/*
	table.children[0].addEventListener('click', function(evt) {
		if ( evt.target.nodeName === 'A' ) {
			var column = evt.target.parentNode;

			if ( sort_options.column !== column.dataset.id ) {
				sort_options.column = column.dataset.id;
			}

			sort_options.direction = column.dataset.direction = (column.dataset.direction === 'desc'? 'asc':'desc');
			render();
			evt.preventDefault();
		}
	}, false);

	search_input.addEventListener('keypress', (function() {
		var delay = null;

		return function(evt) {
			clearTimeout(delay);

			delay = setTimeout(function() {
				search(evt.target.value);
				render();
			}, 300);
		};
	}()));

	pagination.addEventListener('click', function(evt) {
		if ( evt.target.dataset.action !== '' ) {
			if ( evt.target.dataset.action === 'first' ) {
				current_position = 0;
			} else if ( evt.target.dataset.action === 'previous' ) {
				current_position -= options.pagination_step;
			} else if ( evt.target.dataset.action === 'next' ) {
				current_position += options.pagination_step;
			} else if ( evt.target.dataset.action === 'last' ) {
				current_position = render_data.length - options.pagination_step;
			}

			if ( current_position < 0 ) {
				current_position = 0;
			} else if ( current_position + 1 > render_data.length ) {
				current_position -= options.pagination_step;
			}

			evt.preventDefault();
			render();
		}
	});

	setTimeout(function() {
		init(goptions, window.gdata);
		render();
	}, 100);
   */
}(window, window.document, void(0)));
