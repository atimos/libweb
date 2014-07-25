'use strict';

export function create() {
		var events = {};

		return {
			trigger: function(name, data) {
				if ( Array.isArray(events[name]) ) {
					events[name].forEach(function(fn) {
						fn(data);
					});
				}
			},
			on: function(name, fn) {
				if ( !Array.isArray(events[name]) ) {
					events[name] = [];
				}
				if ( Object.prototype.toString.call(fn) === '[object Function]' ) {
					events[name].push(fn);
				}
			}
		};
	}
