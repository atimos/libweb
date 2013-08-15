(function(window, document, undefined) {
	'use strict';
	var path = document.querySelector('script[src*="worker/handler.js"]').src.slice(0, -11),
		lib = window.lib = window.lib || {};

	function Worker(script) {
		if ( script.indexOf('/') !== 0 ) {
			script = path + '/' + script;
		}
		this.callback_list = [];
		this.event_list = {};
		this.worker = new window.Worker(path + '/worker.js');
		this.worker.addEventListener('message', this.run.bind(this), false);

		this.on('debug', function(err, data) {
			console.log('Debug: ', err, data);
		});

		this.worker.postMessage({_w: {p: path, s: script}}); 
	}

	Worker.prototype.on = function(message, fn) {
		if ( this.event_list[message] === undefined ) {
			this.event_list[message] = [];
		}
		this.event_list[message].push(fn);
	};

	Worker.prototype.run = function(message) {
		var data = message.data._w, callback, events;

		if ( data !== undefined ) {

			if ( data.c !== undefined ) {
				callback = this.callback_list[data.c];
				this.callback_list[data.c] = undefined;
			}

			if ( data.m !== undefined ) {
				events = this.event_list[data.m];
			}

			if ( data.e !== undefined && data.e !== null ) {
				data.e = new Error(data.e.m, data.e.l, data.e.f);
			}

			if ( callback !== undefined ) {
				callback(data.e, data.d);
			} else if ( events !== undefined ) {
				events.forEach(function(fn) {
					fn(data.e, data.d);
				});
			}
		}
	};

	Worker.prototype.send = function(message, data, callback) {
		var callback_id;

		if ( Object.prototype.toString.call(data) === '[object Function]' ) {
			callback = data;
			data = null;
		}

		if ( Object.prototype.toString.call(callback) === '[object Function]' ) {
			this.callback_list.push(callback);
			callback_id = this.callback_list.length - 1;
		}

		this.worker.postMessage({_w: {m: message, d: data, c: callback_id}});
	};

	lib.Worker = Worker;

}(window, window.document, void(0)));
