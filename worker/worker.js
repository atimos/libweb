'use strict';
function workerEventHandler(self, undefined) {
	var event_list = {};

	function createCallback(message) {
		if ( message.c !== undefined && message.c !== null ) {
			return function(err, data) {
				send(message.m, data, err, message.c);
			};
		}
	}

	function send(message, data, err, cid) {
		var return_data = {
			m: message || null,
			d: data || null,
			e: null,
			c: cid
		};
		if ( err !== undefined && err !== null ) {
			return_data.e = {
				m: err.message || err.toString(),
				l: err.linenumber,
				f: err.filename
			};
		}
		self.postMessage({_w: return_data});
	}

	self.on = function(event, callback) {
		if ( event_list[event] === undefined ) {
			event_list[event] = [];
		}
		event_list[event].push(callback);
	};

	self.send = send;

	return function(message) {
		var data = message.data._w;
		if ( data !== undefined ) {
			if ( data.p ) {
				self.path = data.p;
			}

			if ( data.s ) {
				self.importScripts(data.s);
			}

			if ( event_list[data.m] !== undefined ) {
				event_list[data.m].forEach(function(fn) {
					fn(data.d, createCallback(data));
				});
			}
		}
	};
}
self.addEventListener('message', workerEventHandler(self, void(0)));
