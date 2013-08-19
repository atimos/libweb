(function(window, document, undefined) {
	'use strict';

	var lib = window.lib = window.lib || {};

	lib.xhr = function() {
		var pub = {},
			events = {},
			is_running = false,
			queue = [],
			custom_events = {},
			error = [],
			xhr = new XMLHttpRequest();

		function addToQueue(params, callback) {
			setData(params);
			setQuery(params);
			setAccessHeaders(params);
			queue.push({params: params, callback: callback});
			if ( is_running === false ) {
				send(queue.shift());
			}
		}

		function queryString(data) {
			var i, items = [];

			for ( i in data ) {
				items.push(i + '=' + data[i]);
			}
			return items.join('&');
		}

		function readyStateChange(evt) {
			var readyState = xhr.readyState, status = xhr.status, params = this.params, callback = this.callback, data;
			console.log(readyState);

			if ( readyState === 4 ) {
				try {
					xhr.responseJSON = JSON.parse(xhr.responseText);
				} catch ( err ) {}
			} else {
				xhr.responseJSON = null;
			}

			data = {json: xhr.responseJSON, xml: xhr.responseXML, text: xhr.responseText};

			if ( custom_events[readyState] !== undefined ) {
				custom_events[readyState].forEach(function(fn) {
					fn(evt, data, params);
				});
			}

			if ( readyState === 4 ) {
				if ( custom_events[status] !== undefined ) {
					custom_events[status].forEach(function(fn) {
						fn(evt, data, params);
					});
				}
				if ( status === 200 && Object.prototype.toString.call(callback) === '[object Function]' ) {
					callback(evt, data, params);
				} else if ( status >= 400 ) {
					console.log(params.path, status);
					error.forEach(function(fn) {
						fn(evt, params);
					});
				}

				is_running = false;
				if ( queue.length > 0 ) {
					send(queue.shift());
				}
			}
		}

		pub.on = function(name, fn) {
			if ( name === 'error' ) {
				error.push(fn);
			} else if ( window.isNaN(name) ) {
				xhr.addEventListener(name, fn);
			} else {
				if ( custom_events[name] === undefined ) {
					custom_events[name] = [];
				}
				custom_events[name].push(fn);
			}
			return pub;
		};

		function setQuery(params) {
			var query_string = queryString(params.query);

			if ( query_string !== '' ) {
				query_string = '?' + query_string;
			}
			params.query = query_string;
		}

		function setData(params) {
			params.headers = params.headers || {};
			params.headers["Content-Type"] = 'application/x-www-form-urlencoded;charset=UTF-8';
			params.body = queryString(params.body);
		}

		function setAccessHeaders(params) {
			var i, combined_headers = [];

			for ( i in params.headers ) {
				combined_headers.push(i);
			}
			params.headers['access-control-allow-headers'] = combined_headers.join(', ');
		}

		function send(queue_item) {
			var i, params = queue_item.params;

			is_running = true;

			if ( Object.prototype.toString.call(params.path) !== '[object String]' ) {
				throw Error('Path has to be a string');
			}

			xhr.open(params.method, params.path + params.query, true);

			for ( i in params.headers ) {
				xhr.setRequestHeader(i, params.headers[i]);
			}

			xhr.onreadystatechange = readyStateChange.bind(queue_item);

			for ( i in events ) {
				events[i].forEach(function(fn) {
					xhr.addEventListener(i, fn);
				});
			}

			xhr.send(params.body);
		}

		pub.send = function(method, path, params, cb) {
			if ( Object.prototype.toString.call(params) === '[object Function]' || params === undefined ) {
				cb = params;
				params = {};
			}
			params.path = path;
			params.method = method;
			addToQueue(params, cb);
			return pub;
		};

		pub.get = function(path, params, cb) {
			return pub.send('GET', path, params, cb);
		};

		pub.post = function(path, params, cb) {
			return pub.send('POST', path, params, cb);
		};

		pub.put = function(path, params, cb) {
			return pub.send('PUT', path, params, cb);
		};

		pub.del = function(path, params, cb) {
			return pub.send('DELETE', path, params, cb);
		};

		pub.abort = function(reset_queue) {
			if ( reset_queue === true ) {
				queue.length = 0;
			}
			xhr.abort();
			return pub;
		};

		return pub;
	};
}(window, window.document, void(0)));
